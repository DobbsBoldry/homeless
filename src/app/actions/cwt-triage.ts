'use server';

import * as Sentry from '@sentry/nextjs';
import {
  type CwtTriageCandidate,
  listCwtTriageCandidates,
  summarizeIntakeForTriage,
} from '@/db/queries/cwt-triage';
import { getPersonProfileDelta } from '@/db/queries/person-profile';
import { logAuditEvent } from '@/lib/audit';
import { requireRole } from '@/lib/auth';
import { type CwtTriageResult, generateCwtTriage } from '@/lib/cwt/cwt-triage';
import { generatePreMeetingSummary } from '@/lib/cwt/pre-meeting-summary';
import { recordAiGeneration } from '@/lib/dtrs/data-access';
import { isValidSyntheticPersonRef } from '@/lib/synthetic-person';

const ROLES = ['caseworker', 'shelter_staff', 'admin'] as const;

export type CwtTriageCandidateMeta = {
  candidateId: string;
  kind: 'intake' | 'person';
  // Intake-specific
  label?: string;
  createdAt?: string;
  presenting?: string | null;
  urgency?: string | null;
  topNeeds?: string[];
  flags?: string[];
  // Person-specific
  partners?: number;
  events?: number;
  orgNames?: string[];
  latestEventAt?: string;
};

export type GenerateCwtTriageResult =
  | { ok: true; result: CwtTriageResult; candidates: CwtTriageCandidateMeta[] }
  | { ok: false; error: string };

export async function generateCwtTriageAction(): Promise<GenerateCwtTriageResult> {
  const actor = await requireRole(ROLES);

  try {
    const candidates = await listCwtTriageCandidates({
      intakeWindowDays: 30,
      touchWindowDays: 14,
      limit: 25,
    });
    const result = await generateCwtTriage(candidates);

    await logAuditEvent({
      actorUserId: actor.id,
      action: 'cwt_triage.generated',
      targetTable: 'client_intakes',
      metadata: {
        candidateCount: result.candidateCount,
        picksReturned: result.output.picks.length,
      },
    });
    await recordAiGeneration({
      actorUserId: actor.id,
      resourceType: 'cwt_triage',
      resourceId: 'morning_triage',
      model: result.modelId,
      promptVersion: result.promptVersion,
      metadata: { candidateCount: result.candidateCount },
    });

    const meta: CwtTriageCandidateMeta[] = candidates.map((c) => candidateMeta(c));

    return { ok: true, result, candidates: meta };
  } catch (err) {
    Sentry.captureException(err, { tags: { action: 'generateCwtTriageAction' } });
    return { ok: false, error: 'Triage generation failed. Please try again.' };
  }
}

export type BatchBriefingItem =
  | { ok: true; syntheticPersonRef: string; text: string; modelId: string }
  | { ok: false; syntheticPersonRef: string; error: string };

export type GenerateBatchBriefingsResult =
  | { ok: true; items: BatchBriefingItem[] }
  | { ok: false; error: string };

const BATCH_BRIEFINGS_MAX = 5;
const BRIEFING_LOOKBACK_DAYS = 30;

/**
 * Run `generatePreMeetingSummary` for a list of synthetic person
 * refs in parallel. Used by the caseworker morning-triage page to
 * draft a 30-second briefing for every person-kind pick at once.
 *
 * Per-item failures don't fail the batch (Promise.allSettled), and
 * a missing/invalid ref surfaces as a per-item error rather than
 * killing the whole call.
 */
export async function generateBatchPreMeetingBriefingsAction(
  refs: string[],
): Promise<GenerateBatchBriefingsResult> {
  const actor = await requireRole(ROLES);

  if (!Array.isArray(refs) || refs.length === 0) {
    return { ok: false, error: 'No persons provided.' };
  }
  if (refs.length > BATCH_BRIEFINGS_MAX) {
    return {
      ok: false,
      error: `Batch too large (max ${BATCH_BRIEFINGS_MAX}). Trim the picks and try again.`,
    };
  }
  const seen = new Set<string>();
  const unique = refs.filter((r) => {
    if (seen.has(r)) return false;
    seen.add(r);
    return true;
  });

  const since = new Date();
  since.setDate(since.getDate() - BRIEFING_LOOKBACK_DAYS);

  const settled = await Promise.allSettled(
    unique.map(async (syntheticPersonRef): Promise<BatchBriefingItem> => {
      if (!isValidSyntheticPersonRef(syntheticPersonRef)) {
        return { ok: false, syntheticPersonRef, error: 'Invalid synthetic-person reference.' };
      }
      try {
        const delta = await getPersonProfileDelta(syntheticPersonRef, since);
        const result = await generatePreMeetingSummary(delta);
        await logAuditEvent({
          actorUserId: actor.id,
          action: 'pre_meeting_summary.generated',
          targetTable: 'partner_service_events',
          targetId: syntheticPersonRef,
          metadata: {
            promptVersion: result.modelId,
            daysBack: BRIEFING_LOOKBACK_DAYS,
            via: 'triage_batch',
          },
        });
        await recordAiGeneration({
          actorUserId: actor.id,
          resourceType: 'pre_meeting_summary',
          resourceId: syntheticPersonRef,
          model: result.modelId,
          promptVersion: result.modelId,
          metadata: { daysBack: BRIEFING_LOOKBACK_DAYS, via: 'triage_batch' },
        });
        return { ok: true, syntheticPersonRef, text: result.text, modelId: result.modelId };
      } catch (err) {
        Sentry.captureException(err, {
          tags: { action: 'generateBatchPreMeetingBriefingsAction', ref: syntheticPersonRef },
        });
        return { ok: false, syntheticPersonRef, error: 'Briefing generation failed.' };
      }
    }),
  );

  const items: BatchBriefingItem[] = settled.map((s, i) => {
    if (s.status === 'fulfilled') return s.value;
    return { ok: false, syntheticPersonRef: unique[i], error: 'Unexpected failure.' };
  });

  return { ok: true, items };
}

function candidateMeta(c: CwtTriageCandidate): CwtTriageCandidateMeta {
  if (c.kind === 'intake') {
    const s = summarizeIntakeForTriage(c.intake);
    return {
      candidateId: c.candidateId,
      kind: 'intake',
      label: c.intake.label,
      createdAt: c.intake.createdAt.toISOString(),
      presenting: s.presenting,
      urgency: s.urgency,
      topNeeds: s.topNeeds,
      flags: s.flags,
    };
  }
  return {
    candidateId: c.candidateId,
    kind: 'person',
    partners: c.aggregate.uniqueOrgs,
    events: c.aggregate.totalEvents,
    orgNames: c.aggregate.orgNames,
    latestEventAt: c.aggregate.latestEventAt.toISOString(),
  };
}
