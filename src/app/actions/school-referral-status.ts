'use server';

/**
 * COOR-014 — Server action: update a school referral's status with an optional
 * confirmation note from the caseworker.
 *
 * Auth: admin or caseworker (mirrors canAccessSchoolReferral policy). The actor
 * must be able to access the referral — verified by both role gate AND the same
 * membership check that guards reads (getSchoolReferral). Cross-org write leak
 * is closed: a caseworker member of School A cannot write to a referral owned
 * by School B.
 *
 * The confirmation note (≤ 500 chars) is stored in school_referral_status_events
 * and surfaced to the school liaison on their closed-loop dashboard.
 */

import * as Sentry from '@sentry/nextjs';
import { revalidatePath } from 'next/cache';
import { getSchoolReferral, updateSchoolReferralStatus } from '@/db/queries/school-referrals';
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
 *
 * Membership gate: calls getSchoolReferral before writing. A caseworker who is
 * not a member of the referral's school org receives a 'not found' error — the
 * same response as a missing row — so as not to leak row existence. An
 * unauthorized probe still writes a disclosure-log row (access_denied purpose)
 * via getSchoolReferral, producing an audit trail per FERPA § 99.32.
 *
 * updateSchoolReferralStatus does NOT re-verify membership — the caller (this
 * action) MUST have authorized access via getSchoolReferral first.
 */
export async function addReferralStatusUpdate(
  referralId: string,
  newStatus: SchoolReferralStatus,
  confirmationNote?: string,
): Promise<UpdateReferralStatusResult> {
  // Minor: validate referralId is UUID-shaped before any DB call to avoid leaking
  // whether the route exists vs. the row doesn't exist.
  if (!/^[0-9a-f-]{36}$/i.test(referralId)) {
    return { ok: false, error: 'school_referral not found' };
  }

  const actor = await requireRole(['admin', 'caseworker']);

  if (!ALLOWED_STATUSES.includes(newStatus)) {
    return { ok: false, error: `Unknown status: ${newStatus}` };
  }

  const note = confirmationNote?.trim();
  if (note && note.length > 500) {
    return { ok: false, error: 'Confirmation note must be 500 characters or fewer.' };
  }

  // Critical: membership gate — getSchoolReferral returns null for a caseworker
  // who lacks membership in the referral's school org (or if the row doesn't exist).
  // The write only proceeds for authorized viewers. Admin bypasses membership check
  // naturally (getSchoolReferral already handles that).
  const referral = await getSchoolReferral(referralId, { userId: actor.id, role: actor.role });
  if (!referral) {
    return { ok: false, error: 'school_referral not found' };
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
