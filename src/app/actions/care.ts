'use server';

import * as Sentry from '@sentry/nextjs';
import { eq } from 'drizzle-orm';
import { revalidatePath } from 'next/cache';
import { db } from '@/db/client';
import { listEdTriageCandidates } from '@/db/queries/ed-triage';
import { type EsucCarePlanStatus, esucCarePlanStatusEnum } from '@/db/schema/enums';
import { esucCarePlans } from '@/db/schema/esuc-care-plans';
import { logAuditEvent } from '@/lib/audit';
import { requireRole } from '@/lib/auth';
import { recordAiGeneration } from '@/lib/dtrs/data-access';
import { generateCarePlan, validateCarePlanDisclaimer } from '@/lib/esuc/care-plan';
import { type EdTriageResult, generateEdTriage } from '@/lib/esuc/ed-triage';

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

export type GenerateEdTriageResult =
  | {
      ok: true;
      result: EdTriageResult;
      candidates: Array<{
        patientId: string;
        visitCount: number;
        housingStatus: string;
        latestVisitAt: string;
        lastChiefComplaint: string;
        carePlanStatus: string | null;
      }>;
    }
  | { ok: false; error: string };

export async function generateEdTriageAction(): Promise<GenerateEdTriageResult> {
  const user = await requireRole(CARE_ROLES);

  try {
    const candidates = await listEdTriageCandidates({ windowDays: 180, limit: 20 });
    const result = await generateEdTriage(candidates);

    await logAuditEvent({
      actorUserId: user.id,
      action: 'ed_triage.generated',
      targetTable: 'ed_encounters',
      metadata: {
        candidateCount: result.candidateCount,
        picksReturned: result.output.picks.length,
      },
    });
    await recordAiGeneration({
      actorUserId: user.id,
      resourceType: 'ed_triage',
      resourceId: 'morning_triage',
      model: result.modelId,
      promptVersion: result.promptVersion,
      metadata: { candidateCount: result.candidateCount },
    });

    const candidateMeta = candidates.map((c) => ({
      patientId: c.patientId,
      visitCount: c.visitCount,
      housingStatus: c.housingStatus,
      latestVisitAt: c.latestVisitAt.toISOString(),
      lastChiefComplaint: c.lastChiefComplaint,
      carePlanStatus: c.carePlanStatus,
    }));

    return { ok: true, result, candidates: candidateMeta };
  } catch (err) {
    Sentry.captureException(err, { tags: { action: 'generateEdTriageAction' } });
    return { ok: false, error: 'Triage generation failed. Please try again.' };
  }
}

export type BatchCarePlanItem =
  | { ok: true; patientId: string; planId: string; alreadyExisted: boolean }
  | { ok: false; patientId: string; error: string };

export type GenerateBatchCarePlansResult =
  | { ok: true; items: BatchCarePlanItem[] }
  | { ok: false; error: string };

const BATCH_CAREPLANS_MAX = 5;

/**
 * Run `generateCarePlan` for a list of patient ids in parallel.
 * Used by the ED morning-triage page to draft a care plan for
 * every pick at once. Per-item failures don't fail the batch.
 *
 * `generateCarePlan` is idempotent on (patient_id, prompt_version)
 * — re-running for an already-drafted patient returns the existing
 * plan; we surface that as alreadyExisted=true so the UI can
 * differentiate "fresh draft" from "already on file".
 */
export async function generateCarePlansBatchAction(
  patientIds: string[],
): Promise<GenerateBatchCarePlansResult> {
  const user = await requireRole(CARE_ROLES);

  if (!Array.isArray(patientIds) || patientIds.length === 0) {
    return { ok: false, error: 'No patients provided.' };
  }
  if (patientIds.length > BATCH_CAREPLANS_MAX) {
    return {
      ok: false,
      error: `Batch too large (max ${BATCH_CAREPLANS_MAX}). Trim the picks and try again.`,
    };
  }
  const seen = new Set<string>();
  const unique = patientIds.filter((id) => {
    if (seen.has(id)) return false;
    seen.add(id);
    return true;
  });

  const settled = await Promise.allSettled(
    unique.map(async (patientId): Promise<BatchCarePlanItem> => {
      try {
        const before = await db
          .select({ id: esucCarePlans.id })
          .from(esucCarePlans)
          .where(eq(esucCarePlans.patientId, patientId))
          .limit(1);
        const plan = await generateCarePlan(patientId, user.id);
        const alreadyExisted = before.length > 0 && before[0].id === plan.id;
        await logAuditEvent({
          actorUserId: user.id,
          action: 'care_plan.generated',
          targetTable: 'esuc_care_plans',
          targetId: plan.id,
          metadata: { patientId, alreadyExisted, via: 'triage_batch' },
        });
        return { ok: true, patientId, planId: plan.id, alreadyExisted };
      } catch (err) {
        Sentry.captureException(err, {
          tags: { action: 'generateCarePlansBatchAction', patientId },
        });
        return { ok: false, patientId, error: 'Care plan generation failed.' };
      }
    }),
  );

  const items: BatchCarePlanItem[] = settled.map((s, i) => {
    if (s.status === 'fulfilled') return s.value;
    return { ok: false, patientId: unique[i], error: 'Unexpected failure.' };
  });

  return { ok: true, items };
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
 *
 * 'active' (plan in effect) does NOT go back to 'approved'. Once a
 * plan is in effect the legitimate moves are stay active or archive;
 * to re-edit, push back to 'draft' for re-approval.
 */
const ALLOWED_TRANSITIONS: Record<EsucCarePlanStatus, readonly EsucCarePlanStatus[]> = {
  draft: ['approved', 'archived'],
  approved: ['active', 'draft', 'archived'],
  active: ['draft', 'archived'],
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
