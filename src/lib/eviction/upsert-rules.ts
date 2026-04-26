import type { EvictionFilingSource } from '@/db/schema/enums';
import type { EvictionFiling, NewEvictionFiling } from '@/db/schema/eviction-filings';

/**
 * Pure decision logic for the daily scraper. NO db imports here so unit
 * tests (and any caller doing dry-run analysis) can use it without
 * needing DATABASE_URL set.
 */

export const SOURCE_RANK: Record<EvictionFilingSource, number> = {
  synthetic: 0,
  manual: 1,
  courtnet: 2,
};

export type UpsertAction = 'inserted' | 'updated' | 'unchanged' | 'superseded';

export interface UpsertDecision {
  action: UpsertAction;
  /** Set when action is 'updated' / 'unchanged' / 'superseded' — the row to keep/update. */
  existingMatch?: EvictionFiling;
}

/** Fields the scraper expects to mutate when a case status / facts change over time. */
export function fieldsChanged(prev: EvictionFiling, next: NewEvictionFiling): boolean {
  return (
    prev.status !== next.status ||
    prev.amountClaimedCents !== (next.amountClaimedCents ?? null) ||
    prev.defendantAddress !== (next.defendantAddress ?? null) ||
    prev.plaintiff !== next.plaintiff ||
    prev.causeType !== next.causeType
  );
}

/**
 * Pure: given the rows that already exist for this case_number (any source)
 * and the incoming filing, decide what to do. No I/O.
 */
export function decideUpsert(
  existing: EvictionFiling[],
  incoming: NewEvictionFiling,
): UpsertDecision {
  const incomingRank = SOURCE_RANK[incoming.source];
  const winner = existing.find((r) => SOURCE_RANK[r.source] > incomingRank);
  if (winner) return { action: 'superseded', existingMatch: winner };

  const sameSource = existing.find((r) => r.source === incoming.source);
  if (sameSource) {
    return fieldsChanged(sameSource, incoming)
      ? { action: 'updated', existingMatch: sameSource }
      : { action: 'unchanged', existingMatch: sameSource };
  }
  return { action: 'inserted' };
}
