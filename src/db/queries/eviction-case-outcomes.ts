import { desc, eq } from 'drizzle-orm';
import { db } from '@/db/client';
import {
  type EvictionCaseOutcomeRow,
  evictionCaseOutcomes,
} from '@/db/schema/eviction-case-outcomes';
import { users } from '@/db/schema/users';

export interface CaseOutcomeWithActor {
  outcome: EvictionCaseOutcomeRow;
  actorEmail: string | null;
  actorName: string | null;
}

/**
 * Outcome history for a single filing, most recent first. The actor's
 * email/name come from a LEFT JOIN so a row whose recorded_by_user_id
 * was nulled out by user deletion still renders.
 */
export async function listCaseOutcomes(filingId: string): Promise<CaseOutcomeWithActor[]> {
  const rows = await db
    .select({
      outcome: evictionCaseOutcomes,
      actorEmail: users.email,
      actorFirst: users.firstName,
      actorLast: users.lastName,
    })
    .from(evictionCaseOutcomes)
    .leftJoin(users, eq(users.id, evictionCaseOutcomes.recordedByUserId))
    .where(eq(evictionCaseOutcomes.filingId, filingId))
    .orderBy(desc(evictionCaseOutcomes.createdAt));

  return rows.map((r) => ({
    outcome: r.outcome,
    actorEmail: r.actorEmail ?? null,
    actorName: [r.actorFirst, r.actorLast].filter(Boolean).join(' ') || null,
  }));
}
