'use server';

import * as Sentry from '@sentry/nextjs';
import { eq } from 'drizzle-orm';
import { revalidatePath } from 'next/cache';
import { db } from '@/db/client';
import { type EsucCarePlanStatus, esucCarePlanStatusEnum } from '@/db/schema/enums';
import { esucCarePlans } from '@/db/schema/esuc-care-plans';
import { logAuditEvent } from '@/lib/audit';
import { requireRole } from '@/lib/auth';
import { generateCarePlan, validateCarePlanDisclaimer } from '@/lib/esuc/care-plan';

export type GenerateCarePlanResult = { ok: true } | { ok: false; error: string };

const CARE_ROLES = ['ed_coordinator', 'admin'] as const;

export async function generateCarePlanAction(patientId: string): Promise<GenerateCarePlanResult> {
  const user = await requireRole(CARE_ROLES);

  try {
    await generateCarePlan(patientId, user.id);
  } catch (err) {
    Sentry.captureException(err, { tags: { action: 'generateCarePlanAction', patientId } });
    return { ok: false, error: 'Care plan generation failed.' };
  }

  revalidatePath(`/app/care/patients/${patientId}`);
  return { ok: true };
}

export type SaveCarePlanResult = { ok: true } | { ok: false; error: string };

export async function saveCarePlanAction(
  planId: string,
  planMd: string,
): Promise<SaveCarePlanResult> {
  await requireRole(CARE_ROLES);
  if (planMd.trim().length < 300) {
    return { ok: false, error: 'Care plan must be at least 300 characters.' };
  }
  const dCheck = validateCarePlanDisclaimer(planMd, 'edit');
  if (!dCheck.ok) return { ok: false, error: dCheck.error };

  await db
    .update(esucCarePlans)
    .set({ planMd, updatedAt: new Date() })
    .where(eq(esucCarePlans.id, planId));
  revalidatePath('/app/care');
  return { ok: true };
}

export type ChangeCarePlanStatusResult = { ok: true } | { ok: false; error: string };

const STATUSES: readonly EsucCarePlanStatus[] = esucCarePlanStatusEnum.enumValues;

/**
 * Allowed transitions per current status. Server-authoritative.
 * 'archived' is terminal — re-engaging a patient creates a new plan
 * (bump prompt_version, or after this draft re-iteration, run the
 * generator again with the new version key).
 */
const ALLOWED_TRANSITIONS: Record<EsucCarePlanStatus, readonly EsucCarePlanStatus[]> = {
  draft: ['approved', 'archived'],
  approved: ['active', 'draft', 'archived'],
  active: ['archived', 'approved'],
  archived: [],
};

export async function changeCarePlanStatusAction(
  planId: string,
  patientId: string,
  newStatus: EsucCarePlanStatus,
): Promise<ChangeCarePlanStatusResult> {
  const user = await requireRole(CARE_ROLES);
  if (!STATUSES.includes(newStatus)) return { ok: false, error: 'Invalid status.' };

  const [previous] = await db
    .select({ status: esucCarePlans.status })
    .from(esucCarePlans)
    .where(eq(esucCarePlans.id, planId))
    .limit(1);
  if (!previous) return { ok: false, error: 'Care plan not found.' };

  if (!ALLOWED_TRANSITIONS[previous.status].includes(newStatus)) {
    return {
      ok: false,
      error: `Status transition ${previous.status} → ${newStatus} is not allowed.`,
    };
  }

  await db
    .update(esucCarePlans)
    .set({ status: newStatus, updatedAt: new Date() })
    .where(eq(esucCarePlans.id, planId));

  await logAuditEvent({
    actorUserId: user.id,
    action: 'care_plan.status_changed',
    targetTable: 'esuc_care_plans',
    targetId: planId,
    metadata: { from: previous.status, to: newStatus, patientId },
  });

  revalidatePath(`/app/care/patients/${patientId}`);
  return { ok: true };
}
