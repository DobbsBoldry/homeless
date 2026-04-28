/**
 * PRVN-003 — school_referrals table (FERPA-forked consent surface, ADR 0005)
 *
 * Privacy contract:
 *   - No student last name or date of birth stored here.
 *   - student_first_initial (text) is the maximum student identifier.
 *   - All reads must go through canAccessSchoolReferral in school-referral-policy.ts.
 */
import {
  boolean,
  index,
  integer,
  jsonb,
  pgTable,
  text,
  timestamp,
  uuid,
} from 'drizzle-orm/pg-core';
import {
  schoolReferralGradeBandEnum,
  schoolReferralStatusEnum,
  schoolReferralUrgencyEnum,
} from './enums';
import { partnerOrgs } from './partner-orgs';
import { users } from './users';

export const schoolReferrals = pgTable(
  'school_referrals',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    /** School district's partner_org row. */
    partnerOrgId: uuid('partner_org_id')
      .notNull()
      .references(() => partnerOrgs.id, { onDelete: 'restrict' }),
    /** The liaison who submitted this referral (authenticated user). */
    referringUserId: uuid('referring_user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'restrict' }),
    /**
     * FERPA minimum-necessary: first initial only.
     * DO NOT add last name or DOB — see ADR 0005.
     */
    studentFirstInitial: text('student_first_initial').notNull(),
    /** Optional — not required by M-V but helps service routing. */
    studentAge: integer('student_age'),
    studentGradeBand: schoolReferralGradeBandEnum('student_grade_band'),
    /** Guardian contact info for service coordination. */
    guardianName: text('guardian_name').notNull(),
    guardianContact: text('guardian_contact').notNull(),
    /** Free-text housing situation (required for M-V authorization validation). */
    housingSituation: text('housing_situation').notNull(),
    /** Controlled vocabulary array — see SCHOOL_REFERRAL_SERVICES. */
    servicesRequested: jsonb('services_requested').notNull().default([]),
    urgency: schoolReferralUrgencyEnum('urgency').notNull().default('medium'),
    notes: text('notes'),
    status: schoolReferralStatusEnum('status').notNull().default('received'),
    /** True when the liaison attested M-V authorization at submission time. */
    mvAuthorizationConfirmed: boolean('mv_authorization_confirmed').notNull().default(false),
    receivedAt: timestamp('received_at', { withTimezone: true }).notNull().defaultNow(),
    lastUpdatedAt: timestamp('last_updated_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    index('school_referrals_partner_org_idx').on(t.partnerOrgId),
    index('school_referrals_status_idx').on(t.status),
    index('school_referrals_received_at_idx').on(t.receivedAt),
  ],
);

export type SchoolReferral = typeof schoolReferrals.$inferSelect;
export type NewSchoolReferral = typeof schoolReferrals.$inferInsert;
