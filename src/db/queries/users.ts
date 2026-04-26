import { and, asc, eq, sql } from 'drizzle-orm';
import { db } from '@/db/client';
import { KLA_OWENSBORO_SLUG } from '@/lib/auth';
import { orgMemberships } from '../schema/org-memberships';
import { partnerOrgs } from '../schema/partner-orgs';
import { type User, users } from '../schema/users';

/**
 * Every user with role=attorney AND a membership in the KLA Owensboro
 * partner org. Used by the daily digest cron and any future broadcast
 * surface targeting KLA staff.
 */
export async function listKlaAttorneys(): Promise<User[]> {
  return await db
    .select({
      id: users.id,
      clerkUserId: users.clerkUserId,
      email: users.email,
      firstName: users.firstName,
      lastName: users.lastName,
      role: users.role,
      createdAt: users.createdAt,
      updatedAt: users.updatedAt,
    })
    .from(users)
    .innerJoin(orgMemberships, eq(orgMemberships.userId, users.id))
    .innerJoin(partnerOrgs, eq(orgMemberships.partnerOrgId, partnerOrgs.id))
    .where(and(eq(users.role, 'attorney'), eq(partnerOrgs.slug, KLA_OWENSBORO_SLUG)));
}

export interface UserAdminRow {
  user: User;
  isKlaMember: boolean;
}

/**
 * Every user in the system, with a flag for KLA membership. Used by the
 * admin user-management surface (ADMIN-001). Sorted by created_at DESC
 * so newly-signed-up users appear first.
 */
export async function listUsersForAdmin(): Promise<UserAdminRow[]> {
  // LEFT JOIN to a derived KLA membership existence so we get one row
  // per user even for users without any membership rows.
  const rows = await db
    .select({
      user: users,
      isKlaMember: sql<boolean>`bool_or(${partnerOrgs.slug} = ${KLA_OWENSBORO_SLUG})`,
    })
    .from(users)
    .leftJoin(orgMemberships, eq(orgMemberships.userId, users.id))
    .leftJoin(partnerOrgs, eq(orgMemberships.partnerOrgId, partnerOrgs.id))
    .groupBy(users.id)
    .orderBy(asc(users.createdAt));

  return rows.map((r) => ({ user: r.user, isKlaMember: Boolean(r.isKlaMember) }));
}
