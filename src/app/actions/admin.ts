'use server';

import { eq } from 'drizzle-orm';
import { revalidatePath } from 'next/cache';
import { db } from '@/db/client';
import { orgMemberships } from '@/db/schema/org-memberships';
import { partnerOrgs } from '@/db/schema/partner-orgs';
import { users } from '@/db/schema/users';
import { logAuditEvent } from '@/lib/audit';
import { KLA_OWENSBORO_SLUG, requireRole } from '@/lib/auth';

export type AdminUserActionResult = { ok: true } | { ok: false; error: string };

/**
 * Promote a user to KLA attorney: set role=attorney AND add membership
 * in the kla-owensboro partner org. Both writes happen unconditionally
 * so the action is also a self-heal — if the user is already an attorney
 * but missing membership (or vice versa), they end up correct.
 */
export async function promoteToKlaAttorneyAction(
  targetUserId: string,
): Promise<AdminUserActionResult> {
  const actor = await requireRole(['admin']);

  const [target] = await db
    .select({ id: users.id, email: users.email, role: users.role })
    .from(users)
    .where(eq(users.id, targetUserId))
    .limit(1);
  if (!target) return { ok: false, error: 'User not found.' };

  const [klaOrg] = await db
    .select({ id: partnerOrgs.id })
    .from(partnerOrgs)
    .where(eq(partnerOrgs.slug, KLA_OWENSBORO_SLUG))
    .limit(1);
  if (!klaOrg) {
    return {
      ok: false,
      error: `Partner org '${KLA_OWENSBORO_SLUG}' not found — run pnpm db:seed.`,
    };
  }

  await db
    .update(users)
    .set({ role: 'attorney', updatedAt: new Date() })
    .where(eq(users.id, target.id));

  await db
    .insert(orgMemberships)
    .values({ userId: target.id, partnerOrgId: klaOrg.id, role: 'attorney' })
    .onConflictDoNothing({
      target: [orgMemberships.userId, orgMemberships.partnerOrgId],
    });

  await logAuditEvent({
    actorUserId: actor.id,
    action: 'user.promoted_to_kla_attorney',
    targetTable: 'users',
    targetId: target.id,
    metadata: { previousRole: target.role, targetEmail: target.email },
  });

  revalidatePath('/app/admin/users');
  return { ok: true };
}

/**
 * Demote a user back to 'pending'. Membership rows are left in place
 * for audit; the role check is what gates access. Re-promotion via
 * promoteToKlaAttorneyAction will hit the unique index and no-op.
 */
export async function demoteUserAction(targetUserId: string): Promise<AdminUserActionResult> {
  const actor = await requireRole(['admin']);

  const [target] = await db
    .select({ id: users.id, email: users.email, role: users.role })
    .from(users)
    .where(eq(users.id, targetUserId))
    .limit(1);
  if (!target) return { ok: false, error: 'User not found.' };
  if (target.id === actor.id) {
    return { ok: false, error: 'You cannot demote yourself.' };
  }

  await db
    .update(users)
    .set({ role: 'pending', updatedAt: new Date() })
    .where(eq(users.id, target.id));

  await logAuditEvent({
    actorUserId: actor.id,
    action: 'user.demoted',
    targetTable: 'users',
    targetId: target.id,
    metadata: { previousRole: target.role, targetEmail: target.email },
  });

  revalidatePath('/app/admin/users');
  return { ok: true };
}
