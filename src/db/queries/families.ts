/**
 * SUBP-007 — families w/ children pathway query layer.
 *
 * All mutations are audit-logged inside the same transaction that
 * performs the write so the audit row rolls back atomically with the
 * data (ADR 0003 / pattern carried from foster-youth.ts).
 *
 * Reads are not gated by an inbound-data agreement here — there is no
 * external partner pushing family records (entries originate from the
 * coalition's own pipelines: eviction, ED, school referrals via
 * PRVN-003, SMS intake). The `family_units` table aggregates those
 * existing flows into a families-with-children view.
 */

import { and, desc, eq } from 'drizzle-orm';
import { db } from '@/db/client';
import {
  type FamilyChild,
  type FamilyUnit,
  familyChildren,
  familyUnits,
  type NewFamilyChild,
  type NewFamilyUnit,
} from '@/db/schema/family-units';
import { logAuditEvent } from '@/lib/audit';

export interface ListFamiliesOpts {
  status?: 'active' | 'rehoused' | 'exited' | 'any';
  assignedCaseworkerUserId?: string;
}

export async function listFamilies(opts: ListFamiliesOpts = {}): Promise<FamilyUnit[]> {
  const { status = 'active', assignedCaseworkerUserId } = opts;
  const conditions = [];
  if (status !== 'any') conditions.push(eq(familyUnits.status, status));
  if (assignedCaseworkerUserId) {
    conditions.push(eq(familyUnits.assignedCaseworkerUserId, assignedCaseworkerUserId));
  }
  return db
    .select()
    .from(familyUnits)
    .where(conditions.length > 0 ? and(...(conditions as Parameters<typeof and>)) : undefined)
    .orderBy(desc(familyUnits.createdAt));
}

export async function getFamily(id: string): Promise<FamilyUnit | null> {
  const [row] = await db.select().from(familyUnits).where(eq(familyUnits.id, id)).limit(1);
  return row ?? null;
}

export async function listChildrenForFamily(familyUnitId: string): Promise<FamilyChild[]> {
  return db
    .select()
    .from(familyChildren)
    .where(eq(familyChildren.familyUnitId, familyUnitId))
    .orderBy(desc(familyChildren.createdAt));
}

/**
 * Look up the family record originated by a given source row, if any.
 * Used by the school-referral detail page (PRVN-003) to surface a
 * "family in pipeline" badge when one exists.
 *
 * `entrySignal` discriminates the source kind; `entrySignalId` is the
 * opaque source-row id (e.g. school_referrals.id).
 */
export async function findFamilyByEntrySignal(
  entrySignal: FamilyUnit['entrySignal'],
  entrySignalId: string,
): Promise<FamilyUnit | null> {
  const [row] = await db
    .select()
    .from(familyUnits)
    .where(
      and(eq(familyUnits.entrySignal, entrySignal), eq(familyUnits.entrySignalId, entrySignalId)),
    )
    .limit(1);
  return row ?? null;
}

/**
 * Insert a family unit + its children inside a single transaction.
 * Audit-logs the family creation (id-only metadata).
 */
export async function recordFamily(input: {
  unit: NewFamilyUnit;
  children: Omit<NewFamilyChild, 'familyUnitId'>[];
  actorUserId: string;
}): Promise<FamilyUnit> {
  const { unit, children, actorUserId } = input;

  return db.transaction(async (tx) => {
    const [created] = await tx.insert(familyUnits).values(unit).returning();
    if (!created) throw new Error('family_units insert returned no row');

    if (children.length > 0) {
      await tx
        .insert(familyChildren)
        .values(children.map((c) => ({ ...c, familyUnitId: created.id })));
    }

    await logAuditEvent({
      actorUserId,
      action: 'family_unit.recorded',
      targetTable: 'family_units',
      targetId: created.id,
      metadata: {
        entrySignal: created.entrySignal,
        currentHousingStatus: created.currentHousingStatus,
        childrenCount: created.childrenCount,
        receivingSchoolDistrictId: created.receivingSchoolDistrictId ?? null,
      },
      tx,
    });

    return created;
  });
}

export async function updateFamilyHousingStatus(input: {
  id: string;
  housingStatus: FamilyUnit['currentHousingStatus'];
  actorUserId: string;
}): Promise<FamilyUnit> {
  const { id, housingStatus, actorUserId } = input;
  return db.transaction(async (tx) => {
    const [updated] = await tx
      .update(familyUnits)
      .set({ currentHousingStatus: housingStatus, updatedAt: new Date() })
      .where(eq(familyUnits.id, id))
      .returning();
    if (!updated) throw new Error(`family_units row not found: ${id}`);

    await logAuditEvent({
      actorUserId,
      action: 'family_unit.housing_changed',
      targetTable: 'family_units',
      targetId: id,
      metadata: { newStatus: housingStatus },
      tx,
    });
    return updated;
  });
}

/**
 * System-context: list active families whose school-stability inputs
 * suggest the school-stability scoring engine should re-evaluate.
 * Returns id-only metadata; the Inngest scan computes risk per-family
 * and surfaces alerts.
 */
export async function listActiveFamiliesForStabilityScan(): Promise<FamilyUnit[]> {
  return db
    .select()
    .from(familyUnits)
    .where(eq(familyUnits.status, 'active'))
    .orderBy(desc(familyUnits.createdAt));
}
