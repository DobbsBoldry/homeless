import { and, eq } from 'drizzle-orm';
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
