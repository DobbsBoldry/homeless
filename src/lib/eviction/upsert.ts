import { and, eq } from 'drizzle-orm';
import { db } from '@/db/client';
import type { EvictionFilingSource } from '@/db/schema/enums';
import {
  type EvictionFiling,
  evictionFilings,
  type NewEvictionFiling,
} from '@/db/schema/eviction-filings';

/**
 * Source-preference order: higher index wins. When the daily scraper
 * (EVDT-005) imports the same case_number from CourtNet that already exists
 * as a synthetic-source row (e.g. left over from dev), the courtnet row
 * supersedes — it doesn't get blocked or duplicated.
 */
export const SOURCE_RANK: Record<EvictionFilingSource, number> = {
  synthetic: 0,
  manual: 1,
  courtnet: 2,
};

export type UpsertAction = 'inserted' | 'updated' | 'unchanged' | 'superseded';

export interface UpsertResult {
  action: UpsertAction;
  filing?: EvictionFiling;
}

export interface UpsertDecision {
  action: UpsertAction;
  /** Set when action is 'updated' or 'unchanged' or 'superseded' — the row to keep/update. */
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
 * Pure function: given the rows that already exist for this case_number
 * (any source) and the incoming filing, decide what to do. No I/O.
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

/**
 * Idempotent upsert of one parsed filing. Atomic per row (single
 * transaction) so concurrent scraper runs don't double-insert.
 */
export async function upsertFiling(filing: NewEvictionFiling): Promise<UpsertResult> {
  return await db.transaction(async (tx) => {
    const existing = await tx
      .select()
      .from(evictionFilings)
      .where(eq(evictionFilings.caseNumber, filing.caseNumber));

    const decision = decideUpsert(existing, filing);

    if (decision.action === 'superseded' || decision.action === 'unchanged') {
      return { action: decision.action, filing: decision.existingMatch };
    }
    if (decision.action === 'updated') {
      const [updated] = await tx
        .update(evictionFilings)
        .set({
          plaintiff: filing.plaintiff,
          defendantFirstName: filing.defendantFirstName,
          defendantLastName: filing.defendantLastName,
          defendantAddress: filing.defendantAddress ?? null,
          causeType: filing.causeType,
          amountClaimedCents: filing.amountClaimedCents ?? null,
          status: filing.status,
          rawJson: filing.rawJson,
          updatedAt: new Date(),
        })
        .where(
          and(
            eq(evictionFilings.caseNumber, filing.caseNumber),
            eq(evictionFilings.source, filing.source),
          ),
        )
        .returning();
      return { action: 'updated', filing: updated };
    }

    // 'inserted'
    const [inserted] = await tx.insert(evictionFilings).values(filing).returning();
    return { action: 'inserted', filing: inserted };
  });
}
