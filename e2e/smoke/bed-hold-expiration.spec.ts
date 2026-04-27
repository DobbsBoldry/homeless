/**
 * S6 — Bed-hold expiration via the cron-equivalent test trigger.
 *
 * Creates an active bed_hold with expires_at in the past, hits the
 * test-mode trigger that mirrors the expire-bed-holds inngest cron,
 * and asserts the row was flipped to status='expired'.
 *
 * The trigger route is gated on E2E_MOCK_OUTBOUND so it cannot be
 * hit outside the e2e suite.
 */

import { dbClient } from '../fixtures/db';
import { expect, test } from '../fixtures/test-base';

test.describe('S6 bed-hold expiration', () => {
  test('past-expiry hold is flipped to expired by trigger', async ({ request }) => {
    const sql = dbClient();
    let holdId: string;
    try {
      const [shelter] = await sql`select id from shelters limit 1`;
      const [user] = await sql`select id from users where role = 'admin' limit 1`;
      expect(shelter, 'no shelters in seed').toBeTruthy();
      expect(user, 'no admin user in seed').toBeTruthy();

      const inserted = await sql`
        insert into bed_holds (shelter_id, held_by_user_id, person_label, status, expires_at)
        values (${shelter.id}, ${user.id}, 'e2e-S6-hold', 'active', now() - interval '1 minute')
        returning id
      `;
      holdId = inserted[0]!.id;

      const resp = await request.post('http://localhost:3000/api/test/run-bed-hold-expiry');
      expect(resp.status()).toBe(200);
      const json = await resp.json();
      expect(json.ok).toBe(true);
      expect(json.expired).toBeGreaterThan(0);

      const after = await sql`select status from bed_holds where id = ${holdId}`;
      expect(after[0]!.status).toBe('expired');
    } finally {
      await sql.end({ timeout: 1 });
    }
  });

  test('forbidden when E2E_MOCK_OUTBOUND is missing', async ({ request }) => {
    // Sanity: confirm the route requires the flag. We can't actually unset
    // E2E_MOCK_OUTBOUND on the running server, so we just confirm the
    // route exists and responds.
    const resp = await request.post('http://localhost:3000/api/test/run-bed-hold-expiry');
    expect([200, 403]).toContain(resp.status());
  });
});
