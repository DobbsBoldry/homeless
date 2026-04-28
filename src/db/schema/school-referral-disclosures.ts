/**
 * PRVN-003 — school_referral_disclosures table.
 *
 * FERPA § 99.32 annual disclosure log. One row per access to a referral record.
 * Parents may request a copy of this log for their child's record at any time.
 *
 * Written by recordDisclosure() in school-referral-policy.ts — never write
 * directly; always go through the policy gate.
 *
 * Per ADR 0005 schema verbatim.
 */
import { index, jsonb, pgTable, text, timestamp, uuid } from 'drizzle-orm/pg-core';
import { schoolReferralBasisEnum } from './enums';
import { partnerOrgs } from './partner-orgs';
import { schoolReferrals } from './school-referrals';
import { users } from './users';

export const schoolReferralDisclosures = pgTable(
  'school_referral_disclosures',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    referralId: uuid('referral_id')
      .notNull()
      .references(() => schoolReferrals.id, { onDelete: 'cascade' }),
    /** Null for system-level accesses. */
    accessedByUserId: uuid('accessed_by_user_id').references(() => users.id, {
      onDelete: 'set null',
    }),
    accessedByPartnerOrgId: uuid('accessed_by_partner_org_id').references(() => partnerOrgs.id, {
      onDelete: 'set null',
    }),
    /**
     * Structured purpose string describing why this access occurred.
     * Examples: 'caseworker_case_detail', 'caseworker_queue_view',
     * 'coordinator_triage', 'admin_debug'.
     */
    purpose: text('purpose').notNull(),
    /** Which authorization permitted this access. */
    basis: schoolReferralBasisEnum('basis').notNull(),
    accessedAt: timestamp('accessed_at', { withTimezone: true }).notNull().defaultNow(),
    /** Array of data class labels that were actually surfaced in this access. */
    dataClassesDisclosed: jsonb('data_classes_disclosed').notNull().default([]),
  },
  (t) => [
    index('school_referral_disclosures_referral_idx').on(t.referralId),
    index('school_referral_disclosures_user_idx').on(t.accessedByUserId),
    index('school_referral_disclosures_accessed_at_idx').on(t.accessedAt),
  ],
);

export type SchoolReferralDisclosure = typeof schoolReferralDisclosures.$inferSelect;
export type NewSchoolReferralDisclosure = typeof schoolReferralDisclosures.$inferInsert;
