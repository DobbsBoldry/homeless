/**
 * DTRS-014a-1 — academic-partner invitation query layer.
 *
 * Mint / list / revoke invitations, redeem an invitation (granting the
 * `academic_partner` role to the redeeming user), and strip the role from an
 * existing user. All mutations are audit-logged in the same transaction.
 */
import { desc, eq } from 'drizzle-orm';
import { db } from '@/db/client';
import { type PartnerInvitation, partnerInvitations } from '@/db/schema/partner-invitations';
import { type User, users } from '@/db/schema/users';
import { logAuditEvent } from '@/lib/audit';
import {
  hashInviteToken,
  isInvitationRedeemable,
  looksLikeInviteToken,
  mintInviteToken,
  PARTNER_INVITE_TTL_MS,
} from '@/lib/dtrs';

export interface CreatedInvitation {
  id: string;
  /** Raw token — returned once for the invite link; never re-readable. */
  token: string;
  expiresAt: Date;
}

export async function createPartnerInvitation(input: {
  invitedEmail: string;
  invitedByUserId: string;
  ttlMs?: number;
}): Promise<CreatedInvitation> {
  const token = mintInviteToken();
  const tokenHash = hashInviteToken(token);
  const expiresAt = new Date(Date.now() + (input.ttlMs ?? PARTNER_INVITE_TTL_MS));

  return db.transaction(async (tx) => {
    const [row] = await tx
      .insert(partnerInvitations)
      .values({
        tokenHash,
        invitedEmail: input.invitedEmail,
        invitedByUserId: input.invitedByUserId,
        expiresAt,
      })
      .returning({ id: partnerInvitations.id });
    await logAuditEvent({
      actorUserId: input.invitedByUserId,
      action: 'partner_invitation.created',
      targetTable: 'partner_invitations',
      targetId: row.id,
      metadata: { invitedEmail: input.invitedEmail, expiresAt: expiresAt.toISOString() },
      tx,
    });
    return { id: row.id, token, expiresAt };
  });
}

export async function listPartnerInvitations(): Promise<PartnerInvitation[]> {
  return db.select().from(partnerInvitations).orderBy(desc(partnerInvitations.createdAt));
}

export async function revokePartnerInvitation(id: string, actorUserId: string): Promise<boolean> {
  return db.transaction(async (tx) => {
    const [row] = await tx
      .update(partnerInvitations)
      .set({ revokedAt: new Date() })
      .where(eq(partnerInvitations.id, id))
      .returning({ id: partnerInvitations.id });
    if (!row) return false;
    await logAuditEvent({
      actorUserId,
      action: 'partner_invitation.revoked',
      targetTable: 'partner_invitations',
      targetId: id,
      tx,
    });
    return true;
  });
}

export type RedeemResult = { ok: true; user: User } | { ok: false; error: string };

/**
 * Atomically redeem an invitation for the signed-in user: validate the token,
 * mark it redeemed, and set the user's role to `academic_partner`.
 */
export async function redeemPartnerInvitation(
  rawToken: string,
  redeemingUser: User,
): Promise<RedeemResult> {
  if (!looksLikeInviteToken(rawToken)) return { ok: false, error: 'Invalid invitation link.' };
  const tokenHash = hashInviteToken(rawToken);

  return db.transaction(async (tx) => {
    const [inv] = await tx
      .select()
      .from(partnerInvitations)
      .where(eq(partnerInvitations.tokenHash, tokenHash))
      .limit(1);
    if (!inv) return { ok: false, error: 'Invitation not found.' };
    if (!isInvitationRedeemable(inv, new Date())) {
      return { ok: false, error: 'This invitation has expired or already been used.' };
    }

    await tx
      .update(partnerInvitations)
      .set({ redeemedAt: new Date(), redeemedByUserId: redeemingUser.id })
      .where(eq(partnerInvitations.id, inv.id));

    const [updated] = await tx
      .update(users)
      .set({ role: 'academic_partner', updatedAt: new Date() })
      .where(eq(users.id, redeemingUser.id))
      .returning();

    await logAuditEvent({
      actorUserId: redeemingUser.id,
      action: 'partner_invitation.redeemed',
      targetTable: 'users',
      targetId: redeemingUser.id,
      metadata: { invitationId: inv.id, previousRole: redeemingUser.role },
      tx,
    });
    return { ok: true, user: updated };
  });
}

export async function listAcademicPartners(): Promise<User[]> {
  return db.select().from(users).where(eq(users.role, 'academic_partner'));
}

/** Strip the academic_partner role (back to 'pending'); access is gone immediately. */
export async function revokeAcademicPartnerRole(
  targetUserId: string,
  actorUserId: string,
): Promise<boolean> {
  return db.transaction(async (tx) => {
    const [target] = await tx
      .select({ id: users.id, role: users.role, email: users.email })
      .from(users)
      .where(eq(users.id, targetUserId))
      .limit(1);
    if (!target || target.role !== 'academic_partner') return false;

    await tx
      .update(users)
      .set({ role: 'pending', updatedAt: new Date() })
      .where(eq(users.id, targetUserId));
    await logAuditEvent({
      actorUserId,
      action: 'partner_role.revoked',
      targetTable: 'users',
      targetId: targetUserId,
      metadata: { targetEmail: target.email },
      tx,
    });
    return true;
  });
}
