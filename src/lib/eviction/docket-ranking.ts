import type { EvictionFiling } from '@/db/schema/eviction-filings';

/**
 * One row in the KLA daily docket — a filing plus the (optional) latest
 * risk-score row for the current model version. Unscored filings are
 * still included in the docket but rank last.
 */
export interface RankedDocketRow {
  filing: EvictionFiling;
  score: number | null;
  rationale: string | null;
}

/**
 * Pure comparator mirroring the SQL `ORDER BY COALESCE(score, 0) DESC,
 * filed_at DESC` used by `listRankedDocket`. Exported so tests can verify
 * the ranking semantics without a DB round-trip and so callers that build
 * docket views from cached/in-memory rows sort identically to the DB.
 */
export function compareDocketRanking(a: RankedDocketRow, b: RankedDocketRow): number {
  const aScore = a.score ?? 0;
  const bScore = b.score ?? 0;
  if (aScore !== bScore) return bScore - aScore;
  return b.filing.filedAt.getTime() - a.filing.filedAt.getTime();
}

/** Convenience: stable sort of docket rows by the canonical ranking. */
export function rankDocketRows(rows: RankedDocketRow[]): RankedDocketRow[] {
  return [...rows].sort(compareDocketRanking);
}
