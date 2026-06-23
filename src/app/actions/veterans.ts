'use server';

import { revalidatePath } from 'next/cache';
import { setVeteranVerified } from '@/db/queries/veterans';
import { requireRole } from '@/lib/auth';

export type VeteranActionResult = { ok: true } | { ok: false; error: string };

/**
 * SUBP-006a — caseworker manually toggles the verified flag on a veteran
 * record, with a required reason note (audit-logged in the query layer).
 */
export async function setVeteranVerifiedAction(
  veteranId: string,
  verified: boolean,
  reason: string,
): Promise<VeteranActionResult> {
  const actor = await requireRole(['caseworker', 'admin']);

  const trimmedReason = reason.trim();
  if (!trimmedReason) {
    return { ok: false, error: 'A reason note is required to change veteran status.' };
  }
  if (trimmedReason.length > 500) {
    return { ok: false, error: 'Reason must be 500 characters or fewer.' };
  }

  const updated = await setVeteranVerified(veteranId, verified, trimmedReason, actor.id);
  if (!updated) return { ok: false, error: 'Veteran record not found.' };

  revalidatePath('/app/clients/veterans');
  return { ok: true };
}
