/**
 * SUBP-001 — foster_youth + foster_aging_out_alerts query layer.
 *
 * All individual-record writes gate on `requireDcbsIndividualRecords`
 * (ADR 0006). All mutations are audit-logged inside the same transaction
 * that performs the write so the audit row rolls back atomically with
 * the data.
 */

import { and, asc, desc, eq, isNull } from 'drizzle-orm';
import { db } from '@/db/client';
import type { FosterAgingOutMilestone } from '@/db/schema/enums';
import {
  type FosterAgingOutAlert,
  fosterAgingOutAlerts,
} from '@/db/schema/foster-aging-out-alerts';
import {
  type FosterYouth,
  fosterYouth,
  type NewFosterYouth,
  type SupportsInPlace,
} from '@/db/schema/foster-youth';
import { logAuditEvent } from '@/lib/audit';
import { requireDcbsIndividualRecords, validateSupportsInPlace } from '@/lib/subp';

// ---------------------------------------------------------------------------
// Reads
// ---------------------------------------------------------------------------

export interface ListFosterYouthOpts {
  status?: 'active' | 'aged_out' | 'exited' | 'any';
  dcbsPartnerOrgId?: string;
  assignedCaseworkerUserId?: string;
}

export async function listFosterYouth(opts: ListFosterYouthOpts = {}): Promise<FosterYouth[]> {
  const { status = 'active', dcbsPartnerOrgId, assignedCaseworkerUserId } = opts;
  const conditions = [];
  if (status !== 'any') conditions.push(eq(fosterYouth.status, status));
  if (dcbsPartnerOrgId) conditions.push(eq(fosterYouth.dcbsPartnerOrgId, dcbsPartnerOrgId));
  if (assignedCaseworkerUserId) {
    conditions.push(eq(fosterYouth.assignedCaseworkerUserId, assignedCaseworkerUserId));
  }
  return db
    .select()
    .from(fosterYouth)
    .where(conditions.length > 0 ? and(...(conditions as Parameters<typeof and>)) : undefined)
    .orderBy(asc(fosterYouth.dateOfBirth));
}

export async function getFosterYouth(id: string): Promise<FosterYouth | null> {
  const [row] = await db.select().from(fosterYouth).where(eq(fosterYouth.id, id)).limit(1);
  return row ?? null;
}

export async function listAlertsForYouth(youthId: string): Promise<FosterAgingOutAlert[]> {
  return db
    .select()
    .from(fosterAgingOutAlerts)
    .where(eq(fosterAgingOutAlerts.youthId, youthId))
    .orderBy(desc(fosterAgingOutAlerts.firedAt));
}

export async function listUnacknowledgedAlerts(): Promise<FosterAgingOutAlert[]> {
  return db
    .select()
    .from(fosterAgingOutAlerts)
    .where(isNull(fosterAgingOutAlerts.acknowledgedAt))
    .orderBy(desc(fosterAgingOutAlerts.firedAt));
}

// ---------------------------------------------------------------------------
// Writes — all gate on DCBS DSA + audit-log inside transaction
// ---------------------------------------------------------------------------

/**
 * Create a foster_youth row. Throws `DcbsGateDeniedError` if the partner's
 * DCBS DSA is missing / wrong agency / not authorizing individual records.
 *
 * Used by the synthetic seed; in the future also by the real DCBS feed
 * ingest path (SUBP-003).
 */
export async function recordFosterYouth(
  input: NewFosterYouth & { actorUserId: string },
): Promise<FosterYouth> {
  const { actorUserId, ...data } = input;

  // Validate the supports-in-place shape *before* the gate check so the
  // caller gets a clean structural error before any DB work.
  const validatedSupports = validateSupportsInPlace(data.supportsInPlace);

  // DCBS gate — fail closed if no active DSA / wrong agency / individual
  // records not authorized. See ADR 0006.
  const { agreementId } = await requireDcbsIndividualRecords(data.dcbsPartnerOrgId);

  return db.transaction(async (tx) => {
    const [row] = await tx
      .insert(fosterYouth)
      .values({
        ...data,
        supportsInPlace: validatedSupports,
        updatedAt: new Date(),
      })
      .returning();
    if (!row) throw new Error('foster_youth insert returned no row');

    await logAuditEvent({
      actorUserId,
      action: 'foster_youth.recorded',
      targetTable: 'foster_youth',
      targetId: row.id,
      metadata: {
        dcbsPartnerOrgId: row.dcbsPartnerOrgId,
        dcbsAgreementId: agreementId,
        status: row.status,
      },
      tx,
    });

    return row;
  });
}

/**
 * Update the supports_in_place payload for a youth. Caseworker action;
 * audit-logged inside the transaction.
 */
export async function updateSupportsInPlace(
  id: string,
  supports: SupportsInPlace,
  actorUserId: string,
): Promise<FosterYouth> {
  const validated = validateSupportsInPlace(supports);

  return db.transaction(async (tx) => {
    const [updated] = await tx
      .update(fosterYouth)
      .set({ supportsInPlace: validated, updatedAt: new Date() })
      .where(eq(fosterYouth.id, id))
      .returning();
    if (!updated) throw new Error(`foster_youth row not found: ${id}`);

    await logAuditEvent({
      actorUserId,
      action: 'foster_youth.supports_in_place_updated',
      targetTable: 'foster_youth',
      targetId: id,
      metadata: {
        // Don't echo PHI; just the structural deltas.
        supportsInPlace: validated,
      },
      tx,
    });

    return updated;
  });
}

/**
 * Acknowledge an alert. Idempotent: re-acknowledgement returns the same
 * row without writing again (and without re-auditing).
 */
export async function acknowledgeAlert(
  alertId: string,
  actorUserId: string,
): Promise<FosterAgingOutAlert> {
  return db.transaction(async (tx) => {
    const [existing] = await tx
      .select()
      .from(fosterAgingOutAlerts)
      .where(eq(fosterAgingOutAlerts.id, alertId))
      .limit(1);
    if (!existing) throw new Error(`foster_aging_out_alerts row not found: ${alertId}`);
    if (existing.acknowledgedAt) return existing;

    const [updated] = await tx
      .update(fosterAgingOutAlerts)
      .set({ acknowledgedByUserId: actorUserId, acknowledgedAt: new Date() })
      .where(eq(fosterAgingOutAlerts.id, alertId))
      .returning();
    if (!updated) throw new Error('foster_aging_out_alerts ack update returned no row');

    await logAuditEvent({
      actorUserId,
      action: 'foster_aging_out_alert.acknowledged',
      targetTable: 'foster_aging_out_alerts',
      targetId: alertId,
      metadata: {
        youthId: updated.youthId,
        milestone: updated.milestone,
      },
      tx,
    });

    return updated;
  });
}

/**
 * Record alerts for a youth across one or more milestones. Used by the
 * nightly Inngest milestone-scan job. Idempotent at the (youth, milestone)
 * UNIQUE level — any milestone already recorded is skipped via ON CONFLICT.
 *
 * Returns the milestones that were actually inserted (i.e. ones that
 * weren't already on file).
 */
export async function recordAlertsForYouth(
  youthId: string,
  milestones: FosterAgingOutMilestone[],
): Promise<FosterAgingOutMilestone[]> {
  if (milestones.length === 0) return [];

  const inserted = await db
    .insert(fosterAgingOutAlerts)
    .values(milestones.map((m) => ({ youthId, milestone: m })))
    .onConflictDoNothing({
      target: [fosterAgingOutAlerts.youthId, fosterAgingOutAlerts.milestone],
    })
    .returning({ milestone: fosterAgingOutAlerts.milestone });

  return inserted.map((r) => r.milestone);
}
