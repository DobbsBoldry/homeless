'use server';

import * as Sentry from '@sentry/nextjs';
import { revalidatePath } from 'next/cache';
import { acknowledgeAlert, updateSupportsInPlace } from '@/db/queries/foster-youth';
import { requireRole } from '@/lib/auth';
import { parseSupportsInPlaceForm } from './foster-aging-out-parse';

export type ActionResult = { ok: true } | { ok: false; error: string };

/**
 * Acknowledge an aging-out alert. Caseworker / admin only.
 */
export async function acknowledgeAlertAction(alertId: string): Promise<ActionResult> {
  const user = await requireRole(['caseworker', 'admin']);
  try {
    await acknowledgeAlert(alertId, user.id);
    revalidatePath('/app/clients/foster-aging-out');
    return { ok: true };
  } catch (err) {
    Sentry.captureException(err);
    console.error('[foster-aging-out.ack] failed', err);
    return {
      ok: false,
      error:
        err instanceof Error && err.message.startsWith('foster_aging_out_alerts')
          ? err.message
          : 'Acknowledgement failed — please retry.',
    };
  }
}

/**
 * Update the supports_in_place payload for a youth from a posted FormData.
 */
export async function updateSupportsInPlaceAction(
  youthId: string,
  formData: FormData,
): Promise<ActionResult> {
  const user = await requireRole(['caseworker', 'admin']);

  const parsed = parseSupportsInPlaceForm(formData);
  if (!parsed.ok) return { ok: false, error: parsed.error };

  try {
    await updateSupportsInPlace(youthId, parsed.supports, user.id);
    revalidatePath(`/app/clients/foster-aging-out/${youthId}`);
    revalidatePath('/app/clients/foster-aging-out');
    return { ok: true };
  } catch (err) {
    Sentry.captureException(err);
    console.error('[foster-aging-out.update-supports] failed', err);
    return {
      ok: false,
      error:
        err instanceof Error && err.message.startsWith('supports_in_place')
          ? err.message
          : 'Update failed — please retry.',
    };
  }
}
