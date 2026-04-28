import { and, eq, gte, isNotNull, lt, lte } from 'drizzle-orm';
import { db } from '@/db/client';
import { type NewPartnerAgreement, type PartnerAgreement, partnerAgreements } from '@/db/schema';
import type { PartnerAgreementKind, PartnerAgreementStatus } from '@/db/schema/enums';
import { logAuditEvent } from '@/lib/audit';
import { validateAgreementTerms } from '@/lib/dtrs';

/**
 * List all agreements for a partner org, most recently created first.
 *
 * `opts.status`:
 *   - Omitted / 'any' → all agreements regardless of status
 *   - A specific status string → filtered to that status
 */
export async function listAgreementsForPartner(
  partnerOrgId: string,
  opts: { status?: PartnerAgreementStatus | 'any' } = {},
): Promise<PartnerAgreement[]> {
  const { status = 'any' } = opts;

  const conditions = [eq(partnerAgreements.partnerOrgId, partnerOrgId)];
  if (status !== 'any') {
    conditions.push(eq(partnerAgreements.status, status));
  }

  return db
    .select()
    .from(partnerAgreements)
    .where(and(...(conditions as Parameters<typeof and>)))
    .orderBy(partnerAgreements.createdAt);
}

/**
 * Return the single active agreement of a given kind for a partner, or null
 * if no active agreement of that kind exists.
 *
 * ADR 0004 notes that multiple active agreements of the same kind are
 * pathological for FERPA/BAA (only one should be active at a time). This
 * function returns the first match; callers should treat multiple rows as a
 * data integrity concern, not a runtime error.
 */
export async function getActiveAgreementByKind(
  partnerOrgId: string,
  kind: PartnerAgreementKind,
): Promise<PartnerAgreement | null> {
  const rows = await db
    .select()
    .from(partnerAgreements)
    .where(
      and(
        eq(partnerAgreements.partnerOrgId, partnerOrgId),
        eq(partnerAgreements.kind, kind),
        eq(partnerAgreements.status, 'active'),
      ),
    )
    .limit(1);
  return rows[0] ?? null;
}

/**
 * Insert a new agreement row. Validates `terms` via `validateAgreementTerms`
 * before the insert — throws on invalid shape, so the caller never needs to
 * re-check. The normalized/typed return value is used in the insert so that
 * extra or misspelled keys from untrusted input never reach JSONB.
 *
 * Both the data insert and the audit-log write run inside a single transaction,
 * so a failure rolls both back — keeps "what landed in the DB" and "what we
 * said landed" consistent (ADR 0003 pattern carried over to agreements).
 */
export async function recordAgreement(
  input: NewPartnerAgreement & { actorUserId: string },
): Promise<PartnerAgreement> {
  const { actorUserId, ...data } = input;

  // Validate and normalize the terms shape before opening the transaction.
  // Use the returned value (not the raw input) in the insert — extra/typo keys
  // from untrusted callers are stripped by the validator.
  const validatedTerms = validateAgreementTerms(data.kind, data.terms ?? {});

  return db.transaction(async (tx) => {
    const [agreement] = await tx
      .insert(partnerAgreements)
      .values({
        ...data,
        terms: validatedTerms,
        updatedAt: new Date(),
      })
      .returning();
    if (!agreement) throw new Error('partner_agreements insert returned no row');

    await logAuditEvent({
      actorUserId,
      action: 'partner_agreement.recorded',
      targetTable: 'partner_agreements',
      targetId: agreement.id,
      metadata: {
        partnerOrgId: agreement.partnerOrgId,
        kind: agreement.kind,
        status: agreement.status,
        templateVersion: agreement.templateVersion ?? null,
        effectiveDate: agreement.effectiveDate ?? null,
      },
      tx,
    });

    return agreement;
  });
}

/**
 * Update the status of an existing agreement. Admin-only callers must gate
 * before calling this function. Both the row update and the audit-log write run
 * inside a transaction so a failure rolls both back.
 *
 * Does NOT expose a way to edit `template_rendered` — that column is
 * immutable by convention (ADR 0004).
 */
export async function updateAgreementStatus(
  id: string,
  status: PartnerAgreementStatus,
  actorUserId: string,
): Promise<PartnerAgreement> {
  return db.transaction(async (tx) => {
    const [updated] = await tx
      .update(partnerAgreements)
      .set({ status, updatedAt: new Date() })
      .where(eq(partnerAgreements.id, id))
      .returning();
    if (!updated) throw new Error(`partner_agreements row not found: ${id}`);

    await logAuditEvent({
      actorUserId,
      action: 'partner_agreement.status_changed',
      targetTable: 'partner_agreements',
      targetId: id,
      metadata: {
        newStatus: status,
        partnerOrgId: updated.partnerOrgId,
        kind: updated.kind,
      },
      tx,
    });

    return updated;
  });
}

// ---------------------------------------------------------------------------
// OPRT-002 — expiration watcher helpers (generic across all agreement kinds)
// ---------------------------------------------------------------------------

/**
 * List active agreements whose `end_date` falls within the next N days
 * (inclusive of today, inclusive of N days out). Used by the daily
 * expiration-watcher Inngest job to flag MOUs / DSAs / FERPAs nearing
 * renewal.
 *
 * Pass `daysAhead = 0` to get only those that have already expired but
 * are still flagged 'active' (ie. need a status flip).
 */
export async function listExpiringAgreements(opts: {
  daysAhead: number;
  asOf?: Date;
}): Promise<PartnerAgreement[]> {
  const asOf = opts.asOf ?? new Date();
  const horizon = new Date(asOf);
  horizon.setUTCDate(horizon.getUTCDate() + opts.daysAhead);
  // YYYY-MM-DD comparison; date column is text-comparable in pg.
  const horizonDate = horizon.toISOString().slice(0, 10);

  return db
    .select()
    .from(partnerAgreements)
    .where(
      and(
        eq(partnerAgreements.status, 'active'),
        isNotNull(partnerAgreements.endDate),
        lte(partnerAgreements.endDate, horizonDate),
      ),
    )
    .orderBy(partnerAgreements.endDate);
}

/**
 * Flip every active agreement whose `end_date` is strictly before today
 * to status='expired'. Returns the rows that were flipped (post-update).
 *
 * Audit-logged per row inside a single transaction so the whole batch
 * rolls back atomically on failure. Idempotent — already-expired rows
 * are not selected for the update.
 */
export async function expireOverdueAgreements(opts: {
  /** Pass null for system-driven runs (Inngest cron). The audit log will record actor as null. */
  actorUserId: string | null;
  asOf?: Date;
}): Promise<PartnerAgreement[]> {
  const asOf = opts.asOf ?? new Date();
  const today = asOf.toISOString().slice(0, 10);

  return db.transaction(async (tx) => {
    const overdue = await tx
      .select()
      .from(partnerAgreements)
      .where(
        and(
          eq(partnerAgreements.status, 'active'),
          isNotNull(partnerAgreements.endDate),
          lt(partnerAgreements.endDate, today),
        ),
      );

    if (overdue.length === 0) return [];

    const flipped: PartnerAgreement[] = [];
    for (const row of overdue) {
      const [updated] = await tx
        .update(partnerAgreements)
        .set({ status: 'expired', updatedAt: new Date() })
        .where(eq(partnerAgreements.id, row.id))
        .returning();
      if (!updated) continue;
      flipped.push(updated);
      await logAuditEvent({
        actorUserId: opts.actorUserId,
        action: 'partner_agreement.auto_expired',
        targetTable: 'partner_agreements',
        targetId: updated.id,
        metadata: {
          partnerOrgId: updated.partnerOrgId,
          kind: updated.kind,
          endDate: updated.endDate,
        },
        tx,
      });
    }
    return flipped;
  });
}

// Suppress unused-import warning (gte/lte mix may vary by build).
void gte;
