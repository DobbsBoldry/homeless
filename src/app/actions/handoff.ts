'use server';

/**
 * COOR-012 — server-action wrappers around the inter-agency handoff
 * primitive. UI surfaces (caseworker inbox, case-page initiate button) are
 * CWT-022 territory; these actions are the API the UI will call when it
 * lands.
 *
 * Each action requires a caseworker / admin role and revalidates the
 * receiver inbox + the subject's reentry surface (to update the warm-
 * handoff CTA). The state-machine errors surface as human-readable
 * messages so a calling UI can render them inline.
 */

import * as Sentry from '@sentry/nextjs';
import { revalidatePath } from 'next/cache';
import type { CaseHandoffScopeKind } from '@/db/schema/enums';
import { requireRole } from '@/lib/auth';
import {
  acceptHandoff,
  declineHandoff,
  HandoffGateDeniedError,
  HandoffStateMachineError,
  initiateHandoff,
  recordHandoffConsent,
  revokeHandoff,
} from '@/lib/coor';

export type HandoffActionResult =
  | { ok: true; handoffId: string }
  | { ok: false; error: string; reason?: string };

interface InitiateInput {
  syntheticPersonRef: string;
  fromPartnerOrgId: string;
  toPartnerOrgId: string;
  purpose: string;
  requestedScope: CaseHandoffScopeKind[];
  consentId?: string;
}

export async function initiateHandoffAction(input: InitiateInput): Promise<HandoffActionResult> {
  const user = await requireRole(['caseworker', 'admin']);
  try {
    const handoff = await initiateHandoff({
      syntheticPersonRef: input.syntheticPersonRef,
      fromPartnerOrgId: input.fromPartnerOrgId,
      toPartnerOrgId: input.toPartnerOrgId,
      initiatedByUserId: user.id,
      purpose: input.purpose,
      requestedScope: input.requestedScope,
      consentId: input.consentId,
    });
    revalidatePath('/app/handoffs');
    revalidatePath(`/app/clients/${input.syntheticPersonRef}`);
    return { ok: true, handoffId: handoff.id };
  } catch (err) {
    return failureResult(err, 'initiate');
  }
}

export async function recordHandoffConsentAction(
  handoffId: string,
  consentId: string,
): Promise<HandoffActionResult> {
  const user = await requireRole(['caseworker', 'admin']);
  try {
    const handoff = await recordHandoffConsent(handoffId, consentId, user.id);
    revalidatePath('/app/handoffs');
    revalidatePath(`/app/clients/${handoff.syntheticPersonRef}`);
    return { ok: true, handoffId: handoff.id };
  } catch (err) {
    return failureResult(err, 'record_consent');
  }
}

export async function acceptHandoffAction(handoffId: string): Promise<HandoffActionResult> {
  const user = await requireRole(['caseworker', 'admin']);
  try {
    const handoff = await acceptHandoff(handoffId, user.id);
    revalidatePath('/app/handoffs');
    revalidatePath(`/app/clients/${handoff.syntheticPersonRef}`);
    return { ok: true, handoffId: handoff.id };
  } catch (err) {
    return failureResult(err, 'accept');
  }
}

export async function declineHandoffAction(
  handoffId: string,
  reason: string,
): Promise<HandoffActionResult> {
  const user = await requireRole(['caseworker', 'admin']);
  if (!reason.trim()) {
    return { ok: false, error: 'A decline reason is required.' };
  }
  try {
    const handoff = await declineHandoff(handoffId, user.id, reason.trim());
    revalidatePath('/app/handoffs');
    revalidatePath(`/app/clients/${handoff.syntheticPersonRef}`);
    return { ok: true, handoffId: handoff.id };
  } catch (err) {
    return failureResult(err, 'decline');
  }
}

export async function revokeHandoffAction(handoffId: string): Promise<HandoffActionResult> {
  const user = await requireRole(['caseworker', 'admin']);
  try {
    const handoff = await revokeHandoff(handoffId, user.id);
    revalidatePath('/app/handoffs');
    revalidatePath(`/app/clients/${handoff.syntheticPersonRef}`);
    return { ok: true, handoffId: handoff.id };
  } catch (err) {
    return failureResult(err, 'revoke');
  }
}

function failureResult(err: unknown, op: string): HandoffActionResult {
  if (err instanceof HandoffGateDeniedError) {
    return { ok: false, error: err.message, reason: err.reason };
  }
  if (err instanceof HandoffStateMachineError) {
    return { ok: false, error: err.message, reason: err.reason };
  }
  Sentry.captureException(err);
  console.error(`[handoff.${op}] failed`, err);
  return { ok: false, error: 'Handoff action failed — please retry.' };
}
