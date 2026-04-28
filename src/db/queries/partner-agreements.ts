import { and, eq } from 'drizzle-orm';
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
 * re-check.
 *
 * Audit-log write and data insert are in the same transaction so a failure
 * rolls back both — keeps "what landed in the DB" and "what we said landed"
 * consistent (ADR 0003 pattern carried over to agreements).
 */
export async function recordAgreement(
  input: NewPartnerAgreement & { actorUserId: string },
): Promise<PartnerAgreement> {
  const { actorUserId, ...data } = input;

  // Validate the terms shape before opening the transaction.
  validateAgreementTerms(data.kind!, data.terms ?? {});

  return db.transaction(async (tx) => {
    const [agreement] = await tx
      .insert(partnerAgreements)
      .values({
        ...data,
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
    });

    return agreement;
  });
}

/**
 * Update the status of an existing agreement. Admin-only callers must gate
 * before calling this function. Audit-logged inside a transaction.
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
    });

    return updated;
  });
}
