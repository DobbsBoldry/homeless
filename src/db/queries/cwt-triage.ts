import { and, desc, eq, gte } from 'drizzle-orm';
import type { IntakeProfile } from '@/ai/prompts/intake-extraction';
import { db } from '@/db/client';
import { type ClientIntake, clientIntakes } from '@/db/schema/client-intakes';
import { listCrossOrgTouchpoints, type PersonAggregate } from './partner-service-events';

export type CwtIntakeCandidate = {
  kind: 'intake';
  candidateId: string;
  intake: ClientIntake;
};

export type CwtPersonCandidate = {
  kind: 'person';
  candidateId: string;
  aggregate: PersonAggregate;
};

export type CwtTriageCandidate = CwtIntakeCandidate | CwtPersonCandidate;

/**
 * Build the candidate set for the caseworker morning triage. Two
 * sources, normalized into a discriminated union:
 *
 *  - `intake` — recently extracted intakes (last 30 days). The
 *    presenting issue + urgency are the action signals.
 *  - `person` — synthetic person refs with cross-partner touchpoints
 *    in the last 14 days. The pattern itself is the action signal.
 *
 * candidateId is unique across the union (intake UUID or
 * synthetic_person_ref). The AI references a candidateId in its
 * picks; the UI dispatches by `kind` to render and link.
 */
export async function listCwtTriageCandidates(
  opts: { intakeWindowDays?: number; touchWindowDays?: number; limit?: number } = {},
): Promise<CwtTriageCandidate[]> {
  const intakeWindowDays = opts.intakeWindowDays ?? 30;
  const touchWindowDays = opts.touchWindowDays ?? 14;
  const limit = opts.limit ?? 25;

  const intakeSince = new Date();
  intakeSince.setDate(intakeSince.getDate() - intakeWindowDays);

  const [intakes, touchpoints] = await Promise.all([
    db
      .select()
      .from(clientIntakes)
      .where(and(eq(clientIntakes.status, 'extracted'), gte(clientIntakes.createdAt, intakeSince)))
      .orderBy(desc(clientIntakes.createdAt))
      .limit(limit),
    listCrossOrgTouchpoints({ windowDays: touchWindowDays, limit }),
  ]);

  const intakeCandidates: CwtIntakeCandidate[] = intakes.map((i) => ({
    kind: 'intake',
    candidateId: i.id,
    intake: i,
  }));

  const personCandidates: CwtPersonCandidate[] = touchpoints
    .filter((p) => p.uniqueOrgs >= 2)
    .map((p) => ({
      kind: 'person',
      candidateId: p.syntheticPersonRef,
      aggregate: p,
    }));

  return [...intakeCandidates, ...personCandidates];
}

export function summarizeIntakeForTriage(intake: ClientIntake): {
  presenting: string | null;
  urgency: string | null;
  topNeeds: string[];
  flags: string[];
} {
  const profile = intake.extractedProfile as IntakeProfile | null;
  if (!profile) return { presenting: null, urgency: null, topNeeds: [], flags: [] };
  const flagsObj = (profile.flags ?? {}) as Record<string, boolean>;
  return {
    presenting: profile.presenting_issue ?? null,
    urgency: profile.urgency ?? null,
    topNeeds: Array.isArray(profile.top_needs) ? profile.top_needs.slice(0, 3) : [],
    flags: Object.entries(flagsObj)
      .filter(([, v]) => v === true)
      .map(([k]) => k),
  };
}
