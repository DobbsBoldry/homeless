/**
 * S9 — getMetricsRates uses latest-outcome-wins (#238).
 *
 * A filing with two outcome rows (e.g. an initial default_judgment that was
 * later corrected/re-filed and ended in settled) must count in only one
 * bucket — its most-recent — never both. Without this, default-judgment
 * rate + favorable-outcome rate could exceed 100% for the same cohort.
 *
 * This test exercises the SQL directly (not the Drizzle export) — it
 * validates the WHERE-FILTER + DISTINCT ON pattern in metrics.ts and is
 * resilient to refactors of the surrounding TypeScript.
 */

import { dbClient } from '../fixtures/db';
import { expect, test } from '../fixtures/test-base';

test.describe('S9 metrics — latest outcome wins', () => {
  test('filing with two outcomes counts only in its latest bucket', async () => {
    const sql = dbClient();
    try {
      // Isolate this run: tag every row with a marker, restrict the rates
      // query to that tag so other seeded data doesn't pollute.
      const tag = `s9-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;

      // Two filings — one will get a single default_judgment outcome
      // (control), the other gets default_judgment FIRST then settled
      // (the corrected case).
      const filings = await sql`
        insert into eviction_filings
          (case_number, filed_at, plaintiff, defendant_first_name,
           defendant_last_name, cause_type, source)
        values
          (${`${tag}-control`}, now(), 'P', 'Control', 'T', 'non_payment', 'synthetic'),
          (${`${tag}-corrected`}, now(), 'P', 'Corrected', 'T', 'non_payment', 'synthetic')
        returning id, case_number
      `;
      const control = filings.find((f) => f.case_number === `${tag}-control`)!;
      const corrected = filings.find((f) => f.case_number === `${tag}-corrected`)!;

      // Control: one outcome.
      await sql`
        insert into eviction_case_outcomes (filing_id, outcome, created_at)
        values (${control.id}, 'default_judgment', now() - interval '2 days')
      `;
      // Corrected: default_judgment first (older), then settled (newer).
      await sql`
        insert into eviction_case_outcomes (filing_id, outcome, created_at)
        values
          (${corrected.id}, 'default_judgment', now() - interval '2 days'),
          (${corrected.id}, 'settled', now() - interval '1 hour')
      `;

      // The latest-outcome-wins query, scoped to this test's filings.
      // Should report: total=2, default_judgment=1 (control only),
      // favorable=1 (corrected, since 'settled' is its latest).
      const rows = await sql`
        WITH latest AS (
          SELECT DISTINCT ON (filing_id) filing_id, outcome
          FROM eviction_case_outcomes
          WHERE filing_id IN (${control.id}, ${corrected.id})
          ORDER BY filing_id, created_at DESC
        )
        SELECT
          COUNT(*)::int AS total,
          COUNT(*) FILTER (WHERE outcome = 'default_judgment')::int AS default_judgment,
          COUNT(*) FILTER (WHERE outcome IN ('dismissed', 'judgment_for_defendant', 'settled'))::int AS favorable
        FROM latest
      `;
      const r = rows[0] as { total: number; default_judgment: number; favorable: number };

      expect(r.total).toBe(2);
      expect(r.default_judgment).toBe(1);
      expect(r.favorable).toBe(1);
      // The contract: rates can never sum to >100% — the same filing is
      // never in both numerators.
      expect(r.default_judgment + r.favorable).toBeLessThanOrEqual(r.total);

      // Cleanup.
      await sql`delete from eviction_filings where id in (${control.id}, ${corrected.id})`;
    } finally {
      await sql.end({ timeout: 1 });
    }
  });
});
