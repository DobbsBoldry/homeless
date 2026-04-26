import { and, eq } from 'drizzle-orm';
import { db } from '@/db/client';
import {
  type EvictionFiling,
  evictionFilings,
  type NewEvictionFiling,
} from '@/db/schema/eviction-filings';
import { decideUpsert, type UpsertAction } from './upsert-rules';

export interface UpsertResult {
  action: UpsertAction;
  filing?: EvictionFiling;
}

/**
 * Idempotent upsert of one parsed filing. Atomic per row (single
 * transaction) so concurrent scraper runs don't double-insert.
 *
 * Pure decision logic lives in upsert-rules.ts so unit tests don't need
 * a live DB connection.
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
