/**
 * SUBP-006c — VFW Owensboro referral events.
 *
 * One row per referral a caseworker triggers from a veteran's detail view.
 * `packet` is a JSONB snapshot of the referral packet at trigger time (subject,
 * contact, eligibility summary, matched vouchers) so the printable copy and the
 * audit trail reflect what was actually sent, independent of later edits.
 *
 * PHI fence: synthetic subject data only until the relevant BAA closes.
 */
import { index, jsonb, pgTable, text, timestamp, uuid } from 'drizzle-orm/pg-core';
import { users } from './users';
import { veterans } from './veterans';

export const vfwReferrals = pgTable(
  'vfw_referrals',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    veteranId: uuid('veteran_id')
      .notNull()
      .references(() => veterans.id, { onDelete: 'cascade' }),
    /** Caseworker who triggered the referral; null if the actor is later removed. */
    triggeredByUserId: uuid('triggered_by_user_id').references(() => users.id, {
      onDelete: 'set null',
    }),
    /** Where the referral was sent (fixed to the local VFW post for now). */
    recipient: text('recipient').notNull(),
    /** JSONB snapshot of the packet at trigger time. */
    packet: jsonb('packet').notNull(),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    index('vfw_referrals_veteran_idx').on(t.veteranId),
    index('vfw_referrals_created_idx').on(t.createdAt),
  ],
);

export type VfwReferral = typeof vfwReferrals.$inferSelect;
export type NewVfwReferral = typeof vfwReferrals.$inferInsert;
