import { headers } from 'next/headers';
import { db } from '@/db/client';
import { smsMessages } from '@/db/schema/sms-messages';
import { handleInboundSmsForNumber } from '@/lib/indc/sms-pipeline';
import {
  identifierForPhone,
  twimlEmpty,
  twimlMessage,
  verifyTwilioSignature,
} from '@/lib/indc/twilio-signature';

export const dynamic = 'force-dynamic';

/**
 * Twilio inbound-SMS webhook (INDC-001). Verifies the X-Twilio-Signature
 * header against TWILIO_AUTH_TOKEN (skipped if no token is configured —
 * dev mode), runs the parsed-command pipeline, logs the exchange, and
 * returns inline TwiML so Twilio sends the reply automatically.
 */
export async function POST(req: Request) {
  const authToken = process.env.TWILIO_AUTH_TOKEN;
  const skipSignature = process.env.INDC_SKIP_TWILIO_SIGNATURE === '1';

  const hdrs = await headers();
  const signature = hdrs.get('x-twilio-signature') ?? '';
  const proto = hdrs.get('x-forwarded-proto') ?? 'https';
  const host = hdrs.get('x-forwarded-host') ?? hdrs.get('host') ?? '';
  // Twilio signs against the URL it POSTed to — including the path,
  // excluding any query string.
  const url = new URL(req.url);
  const fullUrl = `${proto}://${host}${url.pathname}`;

  const rawBody = await req.text();
  const searchParams = new URLSearchParams(rawBody);

  if (!skipSignature) {
    if (!authToken) {
      return new Response('twilio webhook not configured', { status: 503 });
    }
    // Pass URLSearchParams so verify handles repeated keys per Twilio's
    // spec (#269 fix). The standard SMS payload doesn't use repeated
    // keys today, but a malicious replay could try to exploit
    // single-value-overwrite if we coerced down to Record<>.
    if (!verifyTwilioSignature(authToken, fullUrl, searchParams, signature)) {
      console.warn('[twilio sms] signature mismatch', {
        fullUrl,
        signaturePresent: Boolean(signature),
      });
      return new Response('invalid signature', { status: 403 });
    }
  }

  // Apply the phone-identifier feature flag at the boundary (#269 fix).
  // Downstream sees an opaque string identifier; whether it's raw E.164
  // or a SHA-256 hash is decided here once.
  const fromNumber = identifierForPhone(searchParams.get('From') ?? 'unknown');
  const toNumber = searchParams.get('To') ?? 'unknown';
  const body = searchParams.get('Body') ?? '';
  const messageSid = searchParams.get('MessageSid');

  let reply: string;
  let intent: string;
  try {
    const result = await handleInboundSmsForNumber(fromNumber, body);
    reply = result.reply;
    intent = result.intent;
  } catch (err) {
    console.error('[twilio sms] pipeline error', err);
    reply = 'Sorry, something went wrong. Try BED again or call 211.';
    intent = 'error';
  }

  try {
    await db.insert(smsMessages).values({
      providerMessageId: messageSid,
      fromNumber,
      toNumber,
      body,
      intent,
      replyBody: reply,
    });
  } catch (err) {
    console.error('[twilio sms] log insert failed', err);
  }

  // STOP messages: Twilio handles delivery suppression; reply with empty
  // TwiML so we don't double-send.
  if (intent === 'stop') {
    return new Response(twimlEmpty(), {
      status: 200,
      headers: { 'content-type': 'text/xml' },
    });
  }

  return new Response(twimlMessage(reply), {
    status: 200,
    headers: { 'content-type': 'text/xml' },
  });
}
