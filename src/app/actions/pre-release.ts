'use server';

import * as Sentry from '@sentry/nextjs';
import { revalidatePath } from 'next/cache';
import {
  markPreReleaseHandoffComplete,
  updatePreReleaseSupports,
} from '@/db/queries/pre-release-subjects';
import { requireRole } from '@/lib/auth';
import { parsePreReleaseSupportsForm } from './pre-release-parse';

export type PreReleaseActionResult = { ok: true } | { ok: false; error: string };

/**
 * Mark a pre-release subject as warm-handoff complete. Idempotent —
 * re-marking returns ok with no audit-log spam (the query layer
 * short-circuits when handed_off_at is already set).
 */
export async function markHandoffCompleteAction(
  subjectId: string,
): Promise<PreReleaseActionResult> {
  const user = await requireRole(['caseworker', 'admin']);
  try {
    await markPreReleaseHandoffComplete(subjectId, user.id);
    revalidatePath('/app/clients/reentry');
    revalidatePath(`/app/clients/reentry/${subjectId}`);
    return { ok: true };
  } catch (err) {
    Sentry.captureException(err);
    console.error('[pre-release.handoff] failed', err);
    return {
      ok: false,
      error:
        err instanceof Error && err.message.startsWith('pre_release_subjects')
          ? err.message
          : 'Handoff confirmation failed — please retry.',
    };
  }
}

/**
 * Update the supports_in_place payload for a subject from a posted FormData.
 */
export async function updatePreReleaseSupportsAction(
  subjectId: string,
  formData: FormData,
): Promise<PreReleaseActionResult> {
  const user = await requireRole(['caseworker', 'admin']);

  const parsed = parsePreReleaseSupportsForm(formData);
  if (!parsed.ok) return { ok: false, error: parsed.error };

  try {
    await updatePreReleaseSupports(subjectId, parsed.supports, user.id);
    revalidatePath(`/app/clients/reentry/${subjectId}`);
    revalidatePath('/app/clients/reentry');
    return { ok: true };
  } catch (err) {
    Sentry.captureException(err);
    console.error('[pre-release.update-supports] failed', err);
    return {
      ok: false,
      error:
        err instanceof Error && err.message.startsWith('supports_in_place')
          ? err.message
          : 'Update failed — please retry.',
    };
  }
}
