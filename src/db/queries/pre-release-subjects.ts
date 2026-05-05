/**
 * SUBP-005 — pre_release_subjects query layer.
 *
 * All individual-record writes gate on `requireKyDocIndividualRecords`
 * (ADR 0009). All mutations are audit-logged inside the same transaction
 * that performs the write so the audit row rolls back atomically.
 */

import { and, asc, eq, isNull, lt } from 'drizzle-orm';
import { db } from '@/db/client';
import {
  type NewPreReleaseSubject,
  type PreReleaseSubject,
  type PreReleaseSupports,
  preReleaseSubjects,
} from '@/db/schema/pre-release-subjects';
import { logAuditEvent } from '@/lib/audit';
import { requireKyDocIndividualRecords, validatePreReleaseSupports } from '@/lib/subp';

// ---------------------------------------------------------------------------
// Reads
// ---------------------------------------------------------------------------

export interface ListPreReleaseSubjectsOpts {
  status?: 'active' | 'handed_off' | 'any';
  kyDocPartnerOrgId?: string;
  assignedCaseworkerUserId?: string;
}

export async function listPreReleaseSubjects(
  opts: ListPreReleaseSubjectsOpts = {},
): Promise<PreReleaseSubject[]> {
  const { status = 'active', kyDocPartnerOrgId, assignedCaseworkerUserId } = opts;
  const conditions = [];
  if (status !== 'any') conditions.push(eq(preReleaseSubjects.status, status));
  if (kyDocPartnerOrgId) {
    conditions.push(eq(preReleaseSubjects.kyDocPartnerOrgId, kyDocPartnerOrgId));
  }
  if (assignedCaseworkerUserId) {
    conditions.push(eq(preReleaseSubjects.assignedCaseworkerUserId, assignedCaseworkerUserId));
  }
  return db
    .select()
    .from(preReleaseSubjects)
    .where(conditions.length > 0 ? and(...(conditions as Parameters<typeof and>)) : undefined)
    .orderBy(asc(preReleaseSubjects.projectedReleaseDate));
}

export async function getPreReleaseSubject(id: string): Promise<PreReleaseSubject | null> {
  const [row] = await db
    .select()
    .from(preReleaseSubjects)
    .where(eq(preReleaseSubjects.id, id))
    .limit(1);
  return row ?? null;
}

/**
 * List subjects whose projected release was strictly before `cutoffDate`
 * AND who have not been handed off. Used by the daily window-expiration
 * sweep — caller decides which of these to actually delete based on the
 * post-release tail.
 */
export async function listSubjectsPastReleaseWithoutHandoff(
  cutoffDate: string,
): Promise<PreReleaseSubject[]> {
  return db
    .select()
    .from(preReleaseSubjects)
    .where(
      and(
        lt(preReleaseSubjects.projectedReleaseDate, cutoffDate),
        isNull(preReleaseSubjects.handedOffAt),
      ),
    );
}

// ---------------------------------------------------------------------------
// Writes — all gate on KY DOC DSA + audit-log inside transaction
// ---------------------------------------------------------------------------

/**
 * Create a pre_release_subjects row. Throws `KyDocGateDeniedError` if the
 * partner's KY DOC DSA is missing / wrong agency / not authorizing
 * individual records / missing the no-recidivism-prediction attestation.
 *
 * Used by the synthetic seed; in the future also by the real KY DOC feed
 * ingest path. Caller must verify that `projectedReleaseDate` falls
 * within the agreement's `pre_release_window_days` BEFORE calling — this
 * function gates on the agreement, not on the window math (that's pure
 * lib code).
 */
export async function recordPreReleaseSubject(
  input: NewPreReleaseSubject & { actorUserId: string },
): Promise<PreReleaseSubject> {
  const { actorUserId, ...data } = input;

  const validatedSupports = validatePreReleaseSupports(data.supportsInPlace);
  const { agreementId } = await requireKyDocIndividualRecords(data.kyDocPartnerOrgId);

  return db.transaction(async (tx) => {
    const [row] = await tx
      .insert(preReleaseSubjects)
      .values({
        ...data,
        supportsInPlace: validatedSupports,
        updatedAt: new Date(),
      })
      .returning();
    if (!row) throw new Error('pre_release_subjects insert returned no row');

    await logAuditEvent({
      actorUserId,
      action: 'pre_release_subject.recorded',
      targetTable: 'pre_release_subjects',
      targetId: row.id,
      metadata: {
        kyDocPartnerOrgId: row.kyDocPartnerOrgId,
        kyDocAgreementId: agreementId,
        status: row.status,
        projectedReleaseDate: row.projectedReleaseDate,
      },
      tx,
    });

    return row;
  });
}

/**
 * Update the supports_in_place payload for a subject. Caseworker action;
 * audit-logged inside the transaction.
 */
export async function updatePreReleaseSupports(
  id: string,
  supports: PreReleaseSupports,
  actorUserId: string,
): Promise<PreReleaseSubject> {
  const validated = validatePreReleaseSupports(supports);

  return db.transaction(async (tx) => {
    const [updated] = await tx
      .update(preReleaseSubjects)
      .set({ supportsInPlace: validated, updatedAt: new Date() })
      .where(eq(preReleaseSubjects.id, id))
      .returning();
    if (!updated) throw new Error(`pre_release_subjects row not found: ${id}`);

    await logAuditEvent({
      actorUserId,
      action: 'pre_release_subject.supports_updated',
      targetTable: 'pre_release_subjects',
      targetId: id,
      metadata: { supportsInPlace: validated },
      tx,
    });

    return updated;
  });
}

/**
 * Mark a subject as warm-handoff complete. Idempotent: re-marking returns
 * the existing row without writing or auditing again. Subjects in this
 * state are exempt from the daily window-expiration sweep.
 */
export async function markPreReleaseHandoffComplete(
  id: string,
  actorUserId: string,
): Promise<PreReleaseSubject> {
  return db.transaction(async (tx) => {
    const [existing] = await tx
      .select()
      .from(preReleaseSubjects)
      .where(eq(preReleaseSubjects.id, id))
      .limit(1);
    if (!existing) throw new Error(`pre_release_subjects row not found: ${id}`);
    if (existing.handedOffAt) return existing;

    const [updated] = await tx
      .update(preReleaseSubjects)
      .set({ status: 'handed_off', handedOffAt: new Date(), updatedAt: new Date() })
      .where(eq(preReleaseSubjects.id, id))
      .returning();
    if (!updated) throw new Error('pre_release_subjects handoff update returned no row');

    await logAuditEvent({
      actorUserId,
      action: 'pre_release_subject.handed_off',
      targetTable: 'pre_release_subjects',
      targetId: id,
      metadata: {
        kyDocPartnerOrgId: updated.kyDocPartnerOrgId,
        projectedReleaseDate: updated.projectedReleaseDate,
        handedOffAt: updated.handedOffAt,
      },
      tx,
    });

    return updated;
  });
}

/**
 * Hard-delete a subject. Used by the daily window-expiration sweep per
 * ADR 0009 § 5.1. Audit-logs the deletion (with the kyDocInmateId so a
 * future investigation can trace the operation), inside the same
 * transaction as the DELETE.
 *
 * The `actorUserId` is null when called from the Inngest sweep (system-
 * driven); the audit row's actor is null in that case, and the metadata
 * carries `system: 'pre-release-window-sweep'`.
 */
export async function deletePreReleaseSubjectForExpiry(
  id: string,
  actorUserId: string | null,
): Promise<void> {
  await db.transaction(async (tx) => {
    const [existing] = await tx
      .select()
      .from(preReleaseSubjects)
      .where(eq(preReleaseSubjects.id, id))
      .limit(1);
    if (!existing) return;

    await tx.delete(preReleaseSubjects).where(eq(preReleaseSubjects.id, id));

    await logAuditEvent({
      actorUserId,
      action: 'pre_release_subject.deleted_for_window_expiry',
      targetTable: 'pre_release_subjects',
      targetId: id,
      metadata: {
        kyDocPartnerOrgId: existing.kyDocPartnerOrgId,
        kyDocInmateId: existing.kyDocInmateId,
        projectedReleaseDate: existing.projectedReleaseDate,
        system: actorUserId ? null : 'pre-release-window-sweep',
      },
      tx,
    });
  });
}

/**
 * Assign a caseworker to a subject. Audit-logged.
 */
export async function assignPreReleaseCaseworker(
  id: string,
  caseworkerUserId: string | null,
  actorUserId: string,
): Promise<PreReleaseSubject> {
  return db.transaction(async (tx) => {
    const [updated] = await tx
      .update(preReleaseSubjects)
      .set({ assignedCaseworkerUserId: caseworkerUserId, updatedAt: new Date() })
      .where(eq(preReleaseSubjects.id, id))
      .returning();
    if (!updated) throw new Error(`pre_release_subjects row not found: ${id}`);

    await logAuditEvent({
      actorUserId,
      action: 'pre_release_subject.caseworker_assigned',
      targetTable: 'pre_release_subjects',
      targetId: id,
      metadata: { caseworkerUserId },
      tx,
    });

    return updated;
  });
}
