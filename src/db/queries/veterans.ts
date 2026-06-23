/**
 * SUBP-006a — veterans query layer.
 *
 * Eligibility is derived (not stored) via `isVeteranEligible` so there is one
 * source of truth for the rule. The verify toggle is audit-logged inside the
 * same transaction as the write, so the audit row rolls back atomically.
 */
import { and, asc, eq } from 'drizzle-orm';
import { db } from '@/db/client';
import { type NewVeteran, type Veteran, veterans } from '@/db/schema/veterans';
import { logAuditEvent } from '@/lib/audit';
import { isVeteranEligible } from '@/lib/subp';

export interface ListVeteransOpts {
  status?: 'active' | 'exited' | 'any';
  assignedCaseworkerUserId?: string;
  /** When true, return only subjects that are currently veteran-eligible. */
  eligibleOnly?: boolean;
}

export async function listVeterans(opts: ListVeteransOpts = {}): Promise<Veteran[]> {
  const { status = 'active', assignedCaseworkerUserId, eligibleOnly = false } = opts;
  const conditions = [];
  if (status !== 'any') conditions.push(eq(veterans.status, status));
  if (assignedCaseworkerUserId) {
    conditions.push(eq(veterans.assignedCaseworkerUserId, assignedCaseworkerUserId));
  }
  const rows = await db
    .select()
    .from(veterans)
    .where(conditions.length > 0 ? and(...(conditions as Parameters<typeof and>)) : undefined)
    .orderBy(asc(veterans.legalLastName), asc(veterans.legalFirstName));

  // Eligibility is derived; filter through the single-source-of-truth rule.
  return eligibleOnly ? rows.filter((r) => isVeteranEligible(r)) : rows;
}

export async function getVeteran(id: string): Promise<Veteran | null> {
  const [row] = await db.select().from(veterans).where(eq(veterans.id, id)).limit(1);
  return row ?? null;
}

export async function createVeteran(input: NewVeteran): Promise<Veteran> {
  const [row] = await db.insert(veterans).values(input).returning();
  return row;
}

/**
 * Set the caseworker-verified flag on a (self-reported) veteran record, with a
 * required reason note. Audit-logged atomically. Returns the updated row, or
 * null if no such veteran.
 */
export async function setVeteranVerified(
  id: string,
  verified: boolean,
  reason: string,
  actorUserId: string,
): Promise<Veteran | null> {
  return db.transaction(async (tx) => {
    const [updated] = await tx
      .update(veterans)
      .set({ caseworkerVerified: verified, updatedAt: new Date() })
      .where(eq(veterans.id, id))
      .returning();
    if (!updated) return null;

    await logAuditEvent({
      actorUserId,
      action: 'veteran.verification_toggled',
      targetTable: 'veterans',
      targetId: id,
      metadata: {
        caseworkerVerified: verified,
        eligibilitySource: updated.eligibilitySource,
        nowEligible: isVeteranEligible(updated),
        reason,
      },
      tx,
    });
    return updated;
  });
}
