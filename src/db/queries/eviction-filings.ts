import { and, desc, eq, sql } from 'drizzle-orm';
import { RISK_SCORE_MODEL_VERSION } from '@/ai/prompts/eviction-risk-score';
import { db } from '@/db/client';
import type { EvictionFilingSource } from '@/db/schema/enums';
import { evictionFilingRiskScores } from '@/db/schema/eviction-filing-risk-scores';
import { type EvictionFiling, evictionFilings } from '@/db/schema/eviction-filings';
import type { RankedDocketRow } from '@/lib/eviction/docket-ranking';

/**
 * Fetch the most recent N filings, ordered by filed_at desc.
 * Optional filter on source (synthetic / manual / courtnet) for the dashboard
 * source-pill control.
 */
export async function listRecentFilings(
  opts: { limit?: number; source?: EvictionFilingSource } = {},
): Promise<EvictionFiling[]> {
  const { limit = 50, source } = opts;
  const base = db.select().from(evictionFilings);
  const filtered = source ? base.where(eq(evictionFilings.source, source)) : base;
  return await filtered.orderBy(desc(evictionFilings.filedAt)).limit(limit);
}

/** Single filing by primary key. Returns null if not found. */
export async function getFilingById(id: string): Promise<EvictionFiling | null> {
  const rows = await db.select().from(evictionFilings).where(eq(evictionFilings.id, id)).limit(1);
  return rows[0] ?? null;
}

/**
 * KLA daily docket: every filing joined to its risk score for the current
 * model version, ordered by (score DESC, filed_at DESC). Unscored filings
 * are included and rank last (COALESCE score = 0).
 *
 * Restricting the join to RISK_SCORE_MODEL_VERSION guarantees one score row
 * per filing (model_version is part of the unique index), so no fan-out.
 * When a new model_version ships, this query continues returning the
 * current-version score; old-version rows are ignored — exactly the
 * eval-comparison semantics described in the schema.
 */
export async function listRankedDocket(opts: { limit?: number } = {}): Promise<RankedDocketRow[]> {
  const { limit = 50 } = opts;
  const rows = await db
    .select({
      filing: evictionFilings,
      score: evictionFilingRiskScores.score,
      rationale: evictionFilingRiskScores.rationale,
    })
    .from(evictionFilings)
    .leftJoin(
      evictionFilingRiskScores,
      and(
        eq(evictionFilingRiskScores.filingId, evictionFilings.id),
        eq(evictionFilingRiskScores.modelVersion, RISK_SCORE_MODEL_VERSION),
      ),
    )
    .orderBy(
      desc(sql`COALESCE(${evictionFilingRiskScores.score}, 0)`),
      desc(evictionFilings.filedAt),
    )
    .limit(limit);
  return rows;
}
