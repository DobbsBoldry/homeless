/**
 * S3 — audit_log is append-only.
 *
 * The application code never mutates audit_log; correctness is enforced
 * at the DB level by triggers (migration 0008). This test exercises the
 * trigger directly.
 */

import { dbClient } from '../fixtures/db';
import { expect, test } from '../fixtures/test-base';

test.describe('S3 audit_log append-only', () => {
  test('UPDATE on audit_log rejected by trigger', async () => {
    const sql = dbClient();
    try {
      const inserted = await sql`
        insert into audit_log (action, target_table, target_id, metadata)
        values ('e2e.audit.update-test', 'audit_log', 's3-test', '{}'::jsonb)
        returning id
      `;
      const id = inserted[0]?.id;
      expect(id).toBeTruthy();

      let threw = false;
      let errMsg = '';
      try {
        await sql`update audit_log set action = 'tampered' where id = ${id}`;
      } catch (err) {
        threw = true;
        errMsg = (err as Error).message;
      }
      expect(threw, `UPDATE was allowed; trigger missing? ${errMsg}`).toBe(true);
    } finally {
      await sql.end({ timeout: 1 });
    }
  });

  test('DELETE on audit_log rejected by trigger', async () => {
    const sql = dbClient();
    try {
      const inserted = await sql`
        insert into audit_log (action, target_table, target_id, metadata)
        values ('e2e.audit.delete-test', 'audit_log', 's3-test', '{}'::jsonb)
        returning id
      `;
      const id = inserted[0]?.id;
      expect(id).toBeTruthy();

      let threw = false;
      let errMsg = '';
      try {
        await sql`delete from audit_log where id = ${id}`;
      } catch (err) {
        threw = true;
        errMsg = (err as Error).message;
      }
      expect(threw, `DELETE was allowed; trigger missing? ${errMsg}`).toBe(true);
    } finally {
      await sql.end({ timeout: 1 });
    }
  });
});
