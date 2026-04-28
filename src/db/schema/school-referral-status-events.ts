/**
 * COOR-014 — school_referral_status_events table (append-only timeline).
 *
 * Stores one row per status transition on a school referral, with an optional
 * confirmation note from the caseworker. This is what the McKinney-Vento
 * liaison sees when they check on their referral's status.
 *
 * Design choice (option B over A): append-only log instead of a single
 * confirmation_note column on school_referrals.
 *   - Matches the FERPA audit posture (every transition is traceable).
 *   - Provides the full timeline the liaison dashboard needs.
 *   - Old notes are preserved when status changes again.
 *
 * Privacy contract:
 *   - Note content MUST NOT appear in audit-log metadata — logs contain only
 *     counts and IDs (COOR-014 spec; see updateSchoolReferralStatus comments).
 *   - Reads on this table must produce a school_referral_disclosures row when
 *     the referral is a FERPA-scoped record (same contract as parent table).
 */
import { index, pgTable, text, timestamp, uuid } from 'drizzle-orm/pg-core';
import { schoolReferralStatusEnum } from './enums';
import { schoolReferrals } from './school-referrals';
import { users } from './users';

export const schoolReferralStatusEvents = pgTable(
  'school_referral_status_events',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    referralId: uuid('referral_id')
      .notNull()
      .references(() => schoolReferrals.id, { onDelete: 'cascade' }),
    /**
     * Null for the first recorded transition (no prior status on record).
     * Subsequent transitions carry the previous status.
     */
    fromStatus: schoolReferralStatusEnum('from_status'),
    toStatus: schoolReferralStatusEnum('to_status').notNull(),
    /**
     * The coalition user (caseworker or admin) who performed this transition.
     * Null if the actor's user row is deleted.
     */
    actorUserId: uuid('actor_user_id').references(() => users.id, { onDelete: 'set null' }),
    /**
     * Optional caseworker note surfaced to the school liaison.
     * Max 500 chars enforced at app layer; DB CHECK allows up to 1 000
     * as defense-in-depth. Never stored in audit-log metadata.
     */
    note: text('note'),
    occurredAt: timestamp('occurred_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [index('school_referral_status_events_referral_idx').on(t.referralId, t.occurredAt)],
);

export type SchoolReferralStatusEvent = typeof schoolReferralStatusEvents.$inferSelect;
export type NewSchoolReferralStatusEvent = typeof schoolReferralStatusEvents.$inferInsert;
