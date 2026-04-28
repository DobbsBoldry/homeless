/**
 * SUBP-001 — foster_aging_out_alerts.
 *
 * One row per (youth, milestone) when the nightly milestone-scan job
 * crosses the youth into a new days-until-18 band (90 / 60 / 30 / 14 / 7 /
 * aged_out). Idempotent at the (youth_id, milestone) UNIQUE level — the
 * job will retry/replay safely without duplicate alerts.
 *
 * Acknowledgement is a caseworker action: setting `acknowledged_by` +
 * `acknowledged_at` is audit-logged via the `subp` domain layer.
 */
import { index, pgTable, timestamp, uniqueIndex, uuid } from 'drizzle-orm/pg-core';
import { fosterAgingOutMilestoneEnum } from './enums';
import { fosterYouth } from './foster-youth';
import { users } from './users';

export const fosterAgingOutAlerts = pgTable(
  'foster_aging_out_alerts',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    youthId: uuid('youth_id')
      .notNull()
      .references(() => fosterYouth.id, { onDelete: 'cascade' }),
    milestone: fosterAgingOutMilestoneEnum('milestone').notNull(),
    firedAt: timestamp('fired_at', { withTimezone: true }).notNull().defaultNow(),
    acknowledgedByUserId: uuid('acknowledged_by_user_id').references(() => users.id, {
      onDelete: 'set null',
    }),
    acknowledgedAt: timestamp('acknowledged_at', { withTimezone: true }),
  },
  (t) => [
    // Idempotency for the nightly milestone scan — composite UNIQUE prevents
    // a second alert row for the same (youth, milestone) pair, even on
    // replay or clock skew.
    uniqueIndex('foster_aging_out_alerts_youth_milestone_uniq').on(t.youthId, t.milestone),
    index('foster_aging_out_alerts_unack_idx').on(t.acknowledgedAt),
    index('foster_aging_out_alerts_fired_idx').on(t.firedAt),
  ],
);

export type FosterAgingOutAlert = typeof fosterAgingOutAlerts.$inferSelect;
export type NewFosterAgingOutAlert = typeof fosterAgingOutAlerts.$inferInsert;
