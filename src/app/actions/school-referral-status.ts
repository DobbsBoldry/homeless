'use server';

/**
 * COOR-014 — Server action: update a school referral's status with an optional
 * confirmation note from the caseworker.
 *
 * Auth: admin or caseworker (mirrors canAccessSchoolReferral policy). The actor
 * must be able to access the referral — verified by the same role gate.
 *
 * The confirmation note (≤ 500 chars) is stored in school_referral_status_events
 * and surfaced to the school liaison on their closed-loop dashboard.
 */

import * as Sentry from '@sentry/nextjs';
import { revalidatePath } from 'next/cache';
import { updateSchoolReferralStatus } from '@/db/queries/school-referrals';
import type { SchoolReferralStatus } from '@/db/schema/enums';
import { requireRole } from '@/lib/auth';

export type UpdateReferralStatusResult = { ok: true } | { ok: false; error: string };

const ALLOWED_STATUSES: readonly SchoolReferralStatus[] = [
  'received',
  'triaged',
  'in_progress',
  'connected',
  'closed_unreachable',
  'closed_completed',
];

/**
 * Advance a school referral's status and optionally attach a confirmation note.
 *
 * Accessible by admin and caseworker only (the two roles canAccessSchoolReferral
 * permits for write operations on coalition-side referral management).
 */
export async function addReferralStatusUpdate(
  referralId: string,
  newStatus: SchoolReferralStatus,
  confirmationNote?: string,
): Promise<UpdateReferralStatusResult> {
  const actor = await requireRole(['admin', 'caseworker']);

  if (!ALLOWED_STATUSES.includes(newStatus)) {
    return { ok: false, error: `Unknown status: ${newStatus}` };
  }

  const note = confirmationNote?.trim();
  if (note && note.length > 500) {
    return { ok: false, error: 'Confirmation note must be 500 characters or fewer.' };
  }

  try {
    await updateSchoolReferralStatus(referralId, newStatus, actor.id, {
      confirmationNote: note && note.length > 0 ? note : undefined,
    });

    revalidatePath(`/app/clients/school-referrals/${referralId}`);
    revalidatePath('/app/partner/school-referral/dashboard');
    return { ok: true };
  } catch (err) {
    Sentry.captureException(err);
    console.error('[school-referral-status] update failed', { referralId, newStatus, err });
    const raw = err instanceof Error ? err.message : '';
    const error =
      raw.startsWith('school_referral not found') || raw.startsWith('Confirmation note')
        ? raw
        : 'Update failed — please retry. The error has been logged.';
    return { ok: false, error };
  }
}
