/**
 * S5 — Twilio webhook rejects unsigned/invalid signatures, accepts valid.
 *
 * The handler signs against `${proto}://${host}${path}` where proto defaults
 * to 'https' (production runs behind a reverse proxy). We replicate that
 * canonicalization here.
 */
import { test, expect } from '../fixtures/test-base';
import { createHmac } from 'node:crypto';

const PATH = '/api/webhooks/twilio/sms';
const URL_TO_HIT = `http://localhost:3000${PATH}`;
// The handler reconstructs the URL via x-forwarded-proto (if set) or 'https'.
// In Next dev under Playwright, x-forwarded-proto comes through as http, so
// we sign against http to match what the server actually canonicalizes to.
const SIGNING_URL = `http://localhost:3000${PATH}`;

function twilioSig(authToken: string, fullUrl: string, params: Record<string, string>): string {
  const sortedKeys = Object.keys(params).sort();
  let canonical = fullUrl;
  for (const k of sortedKeys) canonical += k + params[k];
  return createHmac('sha1', authToken).update(canonical, 'utf-8').digest('base64');
}

test.describe('S5 Twilio webhook signature verification', () => {
  test('no signature -> 403', async ({ request }) => {
    const resp = await request.post(URL_TO_HIT, {
      form: { From: '+15551234567', To: '+15555550100', Body: 'BED' },
    });
    expect(resp.status()).toBe(403);
  });

  test('invalid signature -> 403', async ({ request }) => {
    const resp = await request.post(URL_TO_HIT, {
      form: { From: '+15551234567', To: '+15555550100', Body: 'BED' },
      headers: { 'X-Twilio-Signature': 'this-is-not-a-real-sig' },
    });
    expect(resp.status()).toBe(403);
  });

  test('valid signature -> 200 + TwiML', async ({ request }) => {
    const params = { From: '+15551234567', To: '+15555550100', Body: 'BED' };
    const sig = twilioSig(process.env.TWILIO_AUTH_TOKEN!, SIGNING_URL, params);
    const resp = await request.post(URL_TO_HIT, {
      form: params,
      headers: { 'X-Twilio-Signature': sig },
    });
    expect(resp.status()).toBe(200);
    const xml = await resp.text();
    expect(xml).toContain('<Response>');
  });
});
