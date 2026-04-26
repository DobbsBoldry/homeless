import { index, pgTable, text, timestamp, uuid } from 'drizzle-orm/pg-core';
import { evictionCaseOutcomeEnum } from './enums';
import { evictionFilings } from './eviction-filings';
import { users } from './users';

/**
 * One row per recorded outcome event for a filing. A single filing can
 * have multiple outcome rows (e.g. dismissed and re-filed; or recorded
 * incorrectly and then corrected by another row) — we keep the full
 * history, the outcomes UI shows the most recent first.
 *
 * Append-only by convention. The audit_log triggers (#198) protect
 * audit_log itself; this table is more like a clinical chart — corrections
 * happen by writing a new row, not editing the old one.
 *
 * recorded_by_user_id is set null on user delete so the outcome record
 * survives staff turnover.
 */
export const evictionCaseOutcomes = pgTable(
  'eviction_case_outcomes',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    filingId: uuid('filing_id')
      .notNull()
      .references(() => evictionFilings.id, { onDelete: 'cascade' }),
    outcome: evictionCaseOutcomeEnum('outcome').notNull(),
    notes: text('notes'),
    recordedByUserId: uuid('recorded_by_user_id').references(() => users.id, {
      onDelete: 'set null',
    }),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    index('case_outcomes_filing_idx').on(t.filingId),
    index('case_outcomes_outcome_idx').on(t.outcome),
    index('case_outcomes_created_at_idx').on(t.createdAt),
  ],
);

export type EvictionCaseOutcomeRow = typeof evictionCaseOutcomes.$inferSelect;
export type NewEvictionCaseOutcomeRow = typeof evictionCaseOutcomes.$inferInsert;
