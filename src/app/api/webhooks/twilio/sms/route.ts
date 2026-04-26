import { headers } from 'next/headers';
import { db } from '@/db/client';
import { smsMessages } from '@/db/schema/sms-messages';
import { handleInboundSms } from '@/lib/indc/sms-pipeline';
import { twimlEmpty, twimlMessage, verifyTwilioSignature } from '@/lib/indc/twilio-signature';

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
  const params: Record<string, string> = {};
  for (const [k, v] of new URLSearchParams(rawBody)) params[k] = v;

  if (!skipSignature) {
    if (!authToken) {
      return new Response('twilio webhook not configured', { status: 503 });
    }
    if (!verifyTwilioSignature(authToken, fullUrl, params, signature)) {
      console.warn('[twilio sms] signature mismatch', {
        fullUrl,
        signaturePresent: Boolean(signature),
      });
      return new Response('invalid signature', { status: 403 });
    }
  }

  const fromNumber = params.From ?? 'unknown';
  const toNumber = params.To ?? 'unknown';
  const body = params.Body ?? '';
  const messageSid = params.MessageSid ?? null;

  let reply: string;
  let intent: string;
  try {
    const result = await handleInboundSms(body);
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
