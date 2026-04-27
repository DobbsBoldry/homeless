/**
 * S7 — eviction_response_packets.updated_at auto-bumps on UPDATE.
 *
 * The application code (savePacketAction, changePacketStatusAction) sets
 * updatedAt explicitly on every write. Migration 0032 layers a BEFORE
 * UPDATE trigger underneath so a future writer that forgets cannot leave
 * updated_at stale and silently miscount activity in the metrics queries.
 *
 * This test exercises the trigger directly: insert a packet with a
 * back-dated updated_at, run an UPDATE that touches a different column,
 * and assert updated_at advanced.
 */

import { dbClient } from '../fixtures/db';
import { expect, test } from '../fixtures/test-base';

test.describe('S7 response packet updated_at trigger', () => {
  test('UPDATE without setting updated_at still advances it', async () => {
    const sql = dbClient();
    try {
      // Parent filing — packet has FK to eviction_filings.
      const filing = await sql`
        insert into eviction_filings
          (case_number, filed_at, plaintiff, defendant_first_name,
           defendant_last_name, cause_type, source)
        values
          ('S7-TEST-' || gen_random_uuid()::text, now(), 'Test Plaintiff',
           'Test', 'Tenant', 'non_payment', 'synthetic')
        returning id
      `;
      const filingId = filing[0]?.id;
      expect(filingId).toBeTruthy();

      // Packet with a deliberately back-dated updated_at.
      const inserted = await sql`
        insert into eviction_response_packets
          (filing_id, packet_md, prompt_version, updated_at)
        values
          (${filingId}, 'placeholder packet md', 's7-v1',
           '2024-01-01T00:00:00Z'::timestamptz)
        returning id, updated_at
      `;
      const id = inserted[0]?.id;
      const before = inserted[0]?.updated_at as Date;
      expect(id).toBeTruthy();

      // UPDATE that does NOT mention updated_at — the trigger has to do it.
      await sql`update eviction_response_packets set status = 'rejected' where id = ${id}`;

      const after = await sql`
        select updated_at from eviction_response_packets where id = ${id}
      `;
      const afterTs = after[0]?.updated_at as Date;
      expect(afterTs.getTime()).toBeGreaterThan(before.getTime());
      // And it should be recent — sanity-check the trigger used NOW(),
      // not some constant. Within 60s of the test running.
      expect(Date.now() - afterTs.getTime()).toBeLessThan(60_000);

      // Cleanup — cascade deletes the packet via filing FK.
      await sql`delete from eviction_filings where id = ${filingId}`;
    } finally {
      await sql.end({ timeout: 1 });
    }
  });
});
