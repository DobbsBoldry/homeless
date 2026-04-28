import { sql } from 'drizzle-orm';
import {
  boolean,
  check,
  date,
  index,
  integer,
  pgTable,
  text,
  timestamp,
  uniqueIndex,
  uuid,
} from 'drizzle-orm/pg-core';
import { faithAggregatePeriodKindEnum } from './enums';
import { faithMinistries } from './faith-ministries';
import { users } from './users';

/**
 * One row per (ministry, period) aggregate submission. The submission
 * carries no individual-level data — only counts split across the
 * `faith_aggregate_metrics` and `faith_aggregate_breakouts` child
 * tables. See ADR 0003 for the privacy contract.
 *
 * `submitted_by_user_id` is the coalition-side user who entered the
 * intake form (DTRS-008) — never a person from the ministry. The
 * ministry's identity-preservation principle means we never even
 * mint a Clerk user for them.
 */
export const faithAggregateSubmissions = pgTable(
  'faith_aggregate_submissions',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    ministryId: uuid('ministry_id')
      .notNull()
      .references(() => faithMinistries.id, { onDelete: 'cascade' }),
    periodKind: faithAggregatePeriodKindEnum('period_kind').notNull(),
    periodStart: date('period_start').notNull(),
    periodEnd: date('period_end').notNull(),
    submittedByUserId: uuid('submitted_by_user_id').references(() => users.id, {
      onDelete: 'set null',
    }),
    submittedAt: timestamp('submitted_at', { withTimezone: true }).notNull().defaultNow(),
    notes: text('notes'),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    uniqueIndex('faith_aggregate_submissions_period_idx').on(
      t.ministryId,
      t.periodStart,
      t.periodEnd,
    ),
    index('faith_aggregate_submissions_ministry_idx').on(t.ministryId),
    index('faith_aggregate_submissions_period_start_idx').on(t.periodStart),
    check('faith_aggregate_submissions_period_order', sql`period_start <= period_end`),
  ],
);

export type FaithAggregateSubmission = typeof faithAggregateSubmissions.$inferSelect;
export type NewFaithAggregateSubmission = typeof faithAggregateSubmissions.$inferInsert;

/**
 * One metric value per (submission, metric_key). Suppression rule: if
 * the partner reports a value below the ministry's `min_cell_size`,
 * the value is NULL and `suppressed = true`. The raw count is never
 * stored — suppression is applied at the entry point (DTRS-008 form
 * handler) before insert. Privacy contract enforced in code, not
 * just docs.
 */
export const faithAggregateMetrics = pgTable(
  'faith_aggregate_metrics',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    submissionId: uuid('submission_id')
      .notNull()
      .references(() => faithAggregateSubmissions.id, { onDelete: 'cascade' }),
    metricKey: text('metric_key').notNull(),
    value: integer('value'),
    suppressed: boolean('suppressed').notNull().default(false),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    uniqueIndex('faith_aggregate_metrics_key_idx').on(t.submissionId, t.metricKey),
    check(
      'faith_aggregate_metrics_value_or_suppressed',
      sql`(value IS NOT NULL AND suppressed = false) OR (value IS NULL AND suppressed = true)`,
    ),
    check('faith_aggregate_metrics_value_nonneg', sql`value IS NULL OR value >= 0`),
  ],
);

export type FaithAggregateMetric = typeof faithAggregateMetrics.$inferSelect;
export type NewFaithAggregateMetric = typeof faithAggregateMetrics.$inferInsert;

/**
 * Demographic breakouts — same suppression rule as metrics. `dimension`
 * + `bucket` are a controlled vocabulary at the application layer
 * (see src/lib/dtrs/faith-aggregate.ts FAITH_BREAKOUT_DIMENSIONS).
 */
export const faithAggregateBreakouts = pgTable(
  'faith_aggregate_breakouts',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    submissionId: uuid('submission_id')
      .notNull()
      .references(() => faithAggregateSubmissions.id, { onDelete: 'cascade' }),
    dimension: text('dimension').notNull(),
    bucket: text('bucket').notNull(),
    count: integer('count'),
    suppressed: boolean('suppressed').notNull().default(false),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    uniqueIndex('faith_aggregate_breakouts_dim_idx').on(t.submissionId, t.dimension, t.bucket),
    check(
      'faith_aggregate_breakouts_count_or_suppressed',
      sql`(count IS NOT NULL AND suppressed = false) OR (count IS NULL AND suppressed = true)`,
    ),
    check('faith_aggregate_breakouts_count_nonneg', sql`count IS NULL OR count >= 0`),
  ],
);

export type FaithAggregateBreakout = typeof faithAggregateBreakouts.$inferSelect;
export type NewFaithAggregateBreakout = typeof faithAggregateBreakouts.$inferInsert;
