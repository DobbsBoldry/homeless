'use server';

import * as Sentry from '@sentry/nextjs';
import {
  type CwtTriageCandidate,
  listCwtTriageCandidates,
  summarizeIntakeForTriage,
} from '@/db/queries/cwt-triage';
import { logAuditEvent } from '@/lib/audit';
import { requireRole } from '@/lib/auth';
import { type CwtTriageResult, generateCwtTriage } from '@/lib/cwt/cwt-triage';
import { recordAiGeneration } from '@/lib/dtrs/data-access';

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
