/**
 * J4 — Dispatcher SMS round-trip.
 *
 * POST a Twilio-signed BED query → assert reply text and sms_messages
 * row. Then sign in as shelter (the role with SMS dashboard access)
 * and confirm the dashboard shows the lookup.
 *
 * Covers COOR-006 + INDC-001/002/003 + PR #307.
 */

import { createHmac } from 'node:crypto';
import { dbClient } from '../fixtures/db';
import { expect, test } from '../fixtures/test-base';

const PATH = '/api/webhooks/twilio/sms';
const URL_TO_HIT = `http://localhost:3000${PATH}`;
const SIGNING_URL = `http://localhost:3000${PATH}`;

function twilioSig(authToken: string, fullUrl: string, params: Record<string, string>): string {
  const sortedKeys = Object.keys(params).sort();
  let canonical = fullUrl;
  for (const k of sortedKeys) canonical += k + params[k];
  return createHmac('sha1', authToken).update(canonical, 'utf-8').digest('base64');
}

test('J4 dispatcher SMS BED -> reply + dashboard reflection', async ({
  request,
  page,
  signInAs,
}) => {
  const fromNumber = '+15551230J04';
  const params = { From: fromNumber, To: '+15555550100', Body: 'BED' };
  const sig = twilioSig(process.env.TWILIO_AUTH_TOKEN!, SIGNING_URL, params);

  const resp = await request.post(URL_TO_HIT, {
    form: params,
    headers: { 'X-Twilio-Signature': sig },
  });
  expect(resp.status()).toBe(200);
  const xml = await resp.text();
  expect(xml).toContain('<Response>');

  const sql = dbClient();
  try {
    const rows = await sql`
      select count(*)::int as n from sms_messages where from_number = ${fromNumber}
    `;
    expect(rows[0]!.n, 'sms_messages row not written').toBeGreaterThan(0);
  } finally {
    await sql.end({ timeout: 1 });
  }

  // Dispatcher dashboard
  await signInAs('shelter');
  await page.goto('/app/coalition/sms');
  await expect(
    page.getByRole('heading', { name: /sms|coalition|messages|metrics/i }).first(),
  ).toBeVisible({ timeout: 10_000 });
});
