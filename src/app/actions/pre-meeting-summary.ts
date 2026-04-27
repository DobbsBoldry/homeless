'use server';

import * as Sentry from '@sentry/nextjs';
import { getPersonProfileDelta } from '@/db/queries/person-profile';
import { logAuditEvent } from '@/lib/audit';
import { requireRole } from '@/lib/auth';
import { generatePreMeetingSummary } from '@/lib/cwt/pre-meeting-summary';
import { recordAiGeneration } from '@/lib/dtrs/data-access';
import { isValidSyntheticPersonRef } from '@/lib/synthetic-person';

export type PreMeetingSummaryResult =
  | { ok: true; text: string; sinceIso: string; model: string }
  | { ok: false; error: string };

const ROLES = ['caseworker', 'shelter_staff', 'ed_coordinator', 'admin'] as const;

const DAYS_MAX = 365;

/**
 * Generate a fresh pre-meeting summary for the given synthetic
 * person ref. `daysBack` defaults to 30; capped at DAYS_MAX.
 */
export async function generatePreMeetingSummaryAction(
  syntheticPersonRef: string,
  daysBack = 30,
): Promise<PreMeetingSummaryResult> {
  const actor = await requireRole(ROLES);

  if (!isValidSyntheticPersonRef(syntheticPersonRef)) {
    return { ok: false, error: 'Invalid synthetic-person reference.' };
  }
  const days = Math.max(1, Math.min(DAYS_MAX, Math.round(daysBack)));
  const since = new Date();
  since.setDate(since.getDate() - days);

  try {
    const delta = await getPersonProfileDelta(syntheticPersonRef, since);
    const result = await generatePreMeetingSummary(delta);

    await logAuditEvent({
      actorUserId: actor.id,
      action: 'pre_meeting_summary.generated',
      targetTable: 'partner_service_events',
      targetId: syntheticPersonRef,
      metadata: { daysBack: days, eventCount: delta.serviceEvents.length },
    });
    await recordAiGeneration({
      actorUserId: actor.id,
      resourceType: 'pre_meeting_summary',
      resourceId: syntheticPersonRef,
      model: result.modelId,
      promptVersion: result.modelId,
      metadata: { daysBack: days },
    });

    return {
      ok: true,
      text: result.text,
      sinceIso: since.toISOString().slice(0, 10),
      model: result.modelId,
    };
  } catch (err) {
    Sentry.captureException(err, {
      tags: { action: 'generatePreMeetingSummaryAction', ref: syntheticPersonRef },
    });
    return {
      ok: false,
      error: 'Summary generation failed. Try again in a moment.',
    };
  }
}
