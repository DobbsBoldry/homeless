'use server';

import { db } from '@/db/client';
import { triageOverrides } from '@/db/schema/triage-overrides';
import { logAuditEvent } from '@/lib/audit';
import { requireRole } from '@/lib/auth';
import { recommendTriageTier, type TriageInputs, type TriageTier } from '@/lib/cwt/triage';

export type RecordTriageOverrideResult =
  | { ok: true; id: string; isOverride: boolean }
  | { ok: false; error: string };

const ROLES = ['caseworker', 'shelter_staff', 'admin'] as const;

const REASON_MAX = 280;

/**
 * Record what the caseworker did with a triage recommendation:
 * either confirmed it (chosen === recommended) or overrode it
 * (chosen !== recommended, with a required rationale). Both cases
 * land in the same table; the dashboard reports override rate by
 * dividing chosen != recommended by total rows.
 *
 * Re-runs the rule engine server-side so a hand-edited client request
 * can't claim a different recommendation than the one the engine
 * actually produced for those inputs.
 */
export async function recordTriageOverrideAction(
  inputs: TriageInputs,
  chosen: TriageTier,
  reason: string | null,
): Promise<RecordTriageOverrideResult> {
  const actor = await requireRole(ROLES);

  const recommendation = recommendTriageTier(inputs);
  const isOverride = chosen !== recommendation.tier;

  if (isOverride) {
    const trimmed = (reason ?? '').trim();
    if (trimmed.length === 0) {
      return { ok: false, error: 'Please write a brief reason for the override.' };
    }
  }

  const trimmedReason = reason?.trim() ? reason.trim().slice(0, REASON_MAX) : null;

  const [created] = await db
    .insert(triageOverrides)
    .values({
      actorUserId: actor.id,
      recommendedTier: recommendation.tier,
      recommendedScore: recommendation.score,
      chosenTier: chosen,
      overrideReason: trimmedReason,
      inputsSnapshot: inputs as unknown as Record<string, unknown>,
      recommendedFactors: recommendation.factors,
    })
    .returning({ id: triageOverrides.id });

  await logAuditEvent({
    actorUserId: actor.id,
    action: isOverride ? 'triage.overridden' : 'triage.confirmed',
    targetTable: 'triage_overrides',
    targetId: created.id,
    metadata: {
      recommendedTier: recommendation.tier,
      chosenTier: chosen,
      recommendedScore: recommendation.score,
    },
  });

  return { ok: true, id: created.id, isOverride };
}
