'use server';

import { revalidatePath } from 'next/cache';
import {
  createPartnerInvitation,
  redeemPartnerInvitation,
  revokeAcademicPartnerRole,
  revokePartnerInvitation,
} from '@/db/queries/partner-invitations';
import { requireRole, requireUser } from '@/lib/auth';

export type InviteActionResult =
  | { ok: true; token: string; expiresAt: string }
  | { ok: false; error: string };

export type SimpleActionResult = { ok: true } | { ok: false; error: string };

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

/**
 * DTRS-014a-1 — admin mints an academic-partner invitation. Returns the raw
 * token once so the admin can share the invite link. (Email delivery via
 * Resend is deferred until that infra lands; the link is shown in the UI.)
 */
export async function invitePartnerAction(fd: FormData): Promise<InviteActionResult> {
  const actor = await requireRole(['admin']);
  const email = (fd.get('invitedEmail') ?? '').toString().trim().toLowerCase();
  if (!EMAIL_RE.test(email)) return { ok: false, error: 'Enter a valid email address.' };

  const created = await createPartnerInvitation({ invitedEmail: email, invitedByUserId: actor.id });
  revalidatePath('/app/admin/academic-partners');
  return { ok: true, token: created.token, expiresAt: created.expiresAt.toISOString() };
}

export async function revokeInvitationAction(id: string): Promise<SimpleActionResult> {
  const actor = await requireRole(['admin']);
  if (!id) return { ok: false, error: 'Missing invitation id.' };
  const ok = await revokePartnerInvitation(id, actor.id);
  if (!ok) return { ok: false, error: 'Invitation not found.' };
  revalidatePath('/app/admin/academic-partners');
  return { ok: true };
}

export async function revokePartnerRoleAction(targetUserId: string): Promise<SimpleActionResult> {
  const actor = await requireRole(['admin']);
  if (!targetUserId) return { ok: false, error: 'Missing user id.' };
  const ok = await revokeAcademicPartnerRole(targetUserId, actor.id);
  if (!ok) return { ok: false, error: 'User is not an academic partner.' };
  revalidatePath('/app/admin/academic-partners');
  return { ok: true };
}

/**
 * Redeem an invitation for the signed-in user, granting the academic_partner
 * role. Any signed-in user (typically a freshly-signed-up invitee) may call it.
 */
export async function redeemPartnerInviteAction(token: string): Promise<SimpleActionResult> {
  const user = await requireUser();
  const result = await redeemPartnerInvitation(token, user);
  if (!result.ok) return { ok: false, error: result.error };
  revalidatePath('/app/invite/accept');
  return { ok: true };
}
