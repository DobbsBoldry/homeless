/**
 * S2 — DV-blind redaction on eviction filing detail.
 *
 * Roles allowed to see un-redacted address on a DV-flagged filing:
 *   attorney, caseworker (per src/lib/dtrs/dv-blind.ts).
 * Other roles (admin, ed_coordinator, shelter_staff) get the
 * `LOCATION_REDACTED` placeholder.
 *
 * Setup: pick a seeded filing with a non-empty defendant_address,
 * flip dv_flag = true on it, then view as `admin` (admin can hit
 * the filings page and is NOT in the address-view set).
 */

import { dbClient } from '../fixtures/db';
import { expect, test } from '../fixtures/test-base';

test.describe('S2 dv-blind redaction', () => {
  test('admin sees LOCATION_REDACTED on dv-flagged filing detail', async ({ page, signInAs }) => {
    const sql = dbClient();
    let filingId: string;
    let originalAddress: string;
    try {
      // Pick any filing with an address. Most fixture rows have one.
      const rows = await sql`
        select id, defendant_address from eviction_filings
        where defendant_address is not null and defendant_address <> '' and dv_flag = false
        limit 1
      `;
      expect(rows.length, 'no seeded filings with addresses available').toBeGreaterThan(0);
      filingId = rows[0]!.id;
      originalAddress = rows[0]!.defendant_address;

      await sql`update eviction_filings set dv_flag = true where id = ${filingId}`;
    } finally {
      await sql.end({ timeout: 1 });
    }

    await signInAs('admin');
    const resp = await page.goto(`/app/cases/filings/${filingId}`);
    expect(resp?.status()).toBeLessThan(400);

    const body = await page.content();
    expect(body, `original address still present: ${originalAddress}`).not.toContain(
      originalAddress,
    );
    expect(body).toContain('LOCATION_REDACTED');
  });
});
