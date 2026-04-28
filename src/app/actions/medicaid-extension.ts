'use server';

import * as Sentry from '@sentry/nextjs';
import { revalidatePath } from 'next/cache';
import {
  draftApplication,
  recordDecision,
  submitApplication,
  withdrawApplication,
} from '@/db/queries/medicaid-extension';
import { requireRole } from '@/lib/auth';
import { parseDraftApplicationForm } from './medicaid-extension-parse';

export type ActionResult = { ok: true; applicationId?: string } | { ok: false; error: string };

const KNOWN_DOMAIN_PREFIXES = [
  'application_payload',
  'Invalid medicaid_extension status transition',
  'medicaid_extension_applications',
] as const;

function surfaceError(err: unknown, fallback: string): string {
  const raw = err instanceof Error ? err.message : '';
  const isKnown = KNOWN_DOMAIN_PREFIXES.some((p) => raw.toLowerCase().startsWith(p.toLowerCase()));
  return isKnown ? raw : fallback;
}

export async function draftMedicaidExtensionAction(
  youthId: string,
  formData: FormData,
): Promise<ActionResult> {
  const user = await requireRole(['caseworker', 'admin']);
  const parsed = parseDraftApplicationForm(formData);
  if (!parsed.ok) return { ok: false, error: parsed.error };

  try {
    const created = await draftApplication({
      youthId,
      payload: parsed.payload,
      draftedByUserId: user.id,
      actorUserId: user.id,
    });
    revalidatePath(`/app/clients/foster-aging-out/${youthId}`);
    revalidatePath(`/app/clients/foster-aging-out/${youthId}/medicaid-extension`);
    revalidatePath('/app/clients/foster-aging-out');
    return { ok: true, applicationId: created.id };
  } catch (err) {
    Sentry.captureException(err);
    console.error('[medicaid-extension.draft] failed', err);
    return {
      ok: false,
      error: surfaceError(err, 'Drafting the application failed — please retry.'),
    };
  }
}

export async function submitMedicaidExtensionAction(
  applicationId: string,
  formData: FormData,
): Promise<ActionResult> {
  const user = await requireRole(['caseworker', 'admin']);
  const kynect = (formData.get('kynect_reference') ?? '').toString().trim() || null;

  try {
    const updated = await submitApplication(applicationId, user.id, kynect);
    revalidatePath(`/app/clients/foster-aging-out/${updated.youthId}`);
    revalidatePath(`/app/clients/foster-aging-out/${updated.youthId}/medicaid-extension`);
    return { ok: true, applicationId: updated.id };
  } catch (err) {
    Sentry.captureException(err);
    return { ok: false, error: surfaceError(err, 'Submit failed — please retry.') };
  }
}

export async function recordDecisionAction(
  applicationId: string,
  outcome: 'approved' | 'denied',
  formData: FormData,
): Promise<ActionResult> {
  const user = await requireRole(['caseworker', 'admin']);
  const reason = (formData.get('decision_reason') ?? '').toString().trim() || null;

  try {
    const updated = await recordDecision(applicationId, outcome, reason, user.id);
    revalidatePath(`/app/clients/foster-aging-out/${updated.youthId}`);
    revalidatePath(`/app/clients/foster-aging-out/${updated.youthId}/medicaid-extension`);
    return { ok: true, applicationId: updated.id };
  } catch (err) {
    Sentry.captureException(err);
    return { ok: false, error: surfaceError(err, 'Decision update failed — please retry.') };
  }
}

export async function withdrawMedicaidExtensionAction(
  applicationId: string,
  formData: FormData,
): Promise<ActionResult> {
  const user = await requireRole(['caseworker', 'admin']);
  const reason = (formData.get('withdraw_reason') ?? '').toString().trim() || null;

  try {
    const updated = await withdrawApplication(applicationId, reason, user.id);
    revalidatePath(`/app/clients/foster-aging-out/${updated.youthId}`);
    revalidatePath(`/app/clients/foster-aging-out/${updated.youthId}/medicaid-extension`);
    return { ok: true, applicationId: updated.id };
  } catch (err) {
    Sentry.captureException(err);
    return { ok: false, error: surfaceError(err, 'Withdraw failed — please retry.') };
  }
}
