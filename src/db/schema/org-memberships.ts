import { index, pgTable, timestamp, uniqueIndex, uuid } from 'drizzle-orm/pg-core';
import { userRoleEnum } from './enums';
import { partnerOrgs } from './partner-orgs';
import { users } from './users';

/**
 * A user can belong to multiple partner orgs, with a possibly different role
 * per org (e.g. admin at their home org, caseworker observer at a partner).
 *
 * The `users.role` column remains the user's primary/global role; this table
 * captures org-scoped role assignments for multi-tenant access checks.
 */
export const orgMemberships = pgTable(
  'org_memberships',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    userId: uuid('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    partnerOrgId: uuid('partner_org_id')
      .notNull()
      .references(() => partnerOrgs.id, { onDelete: 'cascade' }),
    role: userRoleEnum('role').notNull(),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    uniqueIndex('org_memberships_user_org_idx').on(t.userId, t.partnerOrgId),
    index('org_memberships_user_idx').on(t.userId),
    index('org_memberships_partner_org_idx').on(t.partnerOrgId),
  ],
);

export type OrgMembership = typeof orgMemberships.$inferSelect;
export type NewOrgMembership = typeof orgMemberships.$inferInsert;
