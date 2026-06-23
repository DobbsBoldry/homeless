import { date, index, integer, pgTable, text, timestamp, uuid } from 'drizzle-orm/pg-core';
import { fagFeedbackCategoryEnum, fagMemberStatusEnum, fagPayoutStatusEnum } from './enums';
import { users } from './users';

/**
 * OPRT-004: Frontline Advisory Group member registry. Lived-experience
 * advisors who get paid for their time. Per the Strategy Funding page,
 * the coalition's standing policy is $100 per advisor per session +
 * food + transit.
 *
 * Privacy: members are real people with real contact info. The table
 * is admin/coalition-staff visible only; individual advisor records
 * never leave this DB. Compensation entries roll up to public counts
 * (number of advisors paid, total dollars paid out) via an admin-side
 * aggregation, not by exposing rows.
 */
export const fagMembers = pgTable(
  'fag_members',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    fullName: text('full_name').notNull(),
    /** Free-form short label — "lived-experience advisor", "youth advisor", etc. */
    role: text('role').notNull(),
    /**
     * CWT-023a: optional link to the member's platform login. Nullable —
     * not every advisor has an account. When set, it's how the in-app
     * feedback button knows the signed-in user is an advisory member.
     */
    userId: uuid('user_id').references(() => users.id, { onDelete: 'set null' }),
    contactPhone: text('contact_phone'),
    contactEmail: text('contact_email'),
    /** Hourly rate in CENTS. Matches the platform-wide money convention. */
    hourlyRateCents: integer('hourly_rate_cents').notNull().default(10_000),
    status: fagMemberStatusEnum('status').notNull().default('active'),
    /** Free-form notes — accommodations, scheduling preferences, etc. */
    notes: text('notes'),
    /** When the advisor joined the FAG. Date only; payout history starts here. */
    onboardedOn: date('onboarded_on'),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    index('fag_members_status_idx').on(t.status),
    index('fag_members_user_id_idx').on(t.userId),
  ],
);

export type FagMember = typeof fagMembers.$inferSelect;
export type NewFagMember = typeof fagMembers.$inferInsert;

/**
 * CWT-023a: in-app feedback an advisory member submits while using the tool.
 * One row per submission, tagged with the route they were on and a category.
 * Synthetic/non-PHI: feedback is about the tool/process, not a client record.
 */
export const fagFeedback = pgTable(
  'fag_feedback',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    fagMemberId: uuid('fag_member_id')
      .notNull()
      .references(() => fagMembers.id, { onDelete: 'restrict' }),
    userId: uuid('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'restrict' }),
    /** App route the feedback was filed from (auto-detected client-side). */
    route: text('route').notNull(),
    /** Star rating 1–5; range enforced in the parse layer + action. */
    rating: integer('rating').notNull(),
    comment: text('comment'),
    category: fagFeedbackCategoryEnum('category').notNull(),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    index('fag_feedback_member_idx').on(t.fagMemberId),
    index('fag_feedback_user_idx').on(t.userId),
    index('fag_feedback_created_idx').on(t.createdAt),
  ],
);

export type FagFeedback = typeof fagFeedback.$inferSelect;
export type NewFagFeedback = typeof fagFeedback.$inferInsert;

/**
 * One row per session / batch the coalition pays an advisor for. Captures
 * the agreed rate + hours + total at the time the entry was logged so a
 * later rate change doesn't retro-edit older payouts.
 */
export const fagCompensationEntries = pgTable(
  'fag_compensation_entries',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    memberId: uuid('member_id')
      .notNull()
      .references(() => fagMembers.id, { onDelete: 'restrict' }),
    /** Calendar date the work happened. */
    occurredOn: date('occurred_on').notNull(),
    /** What the advisor did — "DTRS-005 consent UX review", etc. */
    description: text('description').notNull(),
    /** Hours billed. Stored as numeric tenths via integer * 10 to avoid floats. */
    hoursTenths: integer('hours_tenths').notNull(),
    /** Rate in cents at time of entry — snapshot, not a FK. */
    hourlyRateCents: integer('hourly_rate_cents').notNull(),
    /** Total owed in cents. Computed at insert; null-safe denormalization. */
    totalCents: integer('total_cents').notNull(),
    status: fagPayoutStatusEnum('status').notNull().default('unpaid'),
    paidAt: timestamp('paid_at', { withTimezone: true }),
    paidByUserId: uuid('paid_by_user_id').references(() => users.id, { onDelete: 'set null' }),
    /** Notes — payout method, transit reimbursement, etc. */
    notes: text('notes'),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    index('fag_compensation_member_idx').on(t.memberId),
    index('fag_compensation_status_idx').on(t.status),
    index('fag_compensation_occurred_idx').on(t.occurredOn),
  ],
);

export type FagCompensationEntry = typeof fagCompensationEntries.$inferSelect;
export type NewFagCompensationEntry = typeof fagCompensationEntries.$inferInsert;
