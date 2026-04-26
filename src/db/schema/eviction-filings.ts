import {
  index,
  integer,
  jsonb,
  pgTable,
  text,
  timestamp,
  uniqueIndex,
  uuid,
} from 'drizzle-orm/pg-core';
import { evictionCauseTypeEnum, evictionFilingSourceEnum, evictionFilingStatusEnum } from './enums';

/**
 * Public record of a filed eviction case.
 *
 * Eviction filings ARE public court records and not PHI — safe to land in
 * the database pre-BAA. The defendant's name and address are public via
 * the court docket. We still segregate `defendant_*` columns from any
 * client-linked tables (the join to a real `clients` row happens in a
 * later story, post-BAA, mediated by a consent record).
 *
 * Multiple sources may produce a row for the same case (manual import,
 * production CourtNet scraper, synthetic generator) — uniqueness is
 * enforced on (case_number, source) so dedup logic in EVDT-007 can
 * resolve preferred-source winners explicitly.
 */
export const evictionFilings = pgTable(
  'eviction_filings',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    caseNumber: text('case_number').notNull(),
    filedAt: timestamp('filed_at', { withTimezone: true }).notNull(),
    courtDivision: text('court_division'),
    plaintiff: text('plaintiff').notNull(),
    defendantFirstName: text('defendant_first_name').notNull(),
    defendantLastName: text('defendant_last_name').notNull(),
    defendantAddress: text('defendant_address'),
    causeType: evictionCauseTypeEnum('cause_type').notNull(),
    amountClaimedCents: integer('amount_claimed_cents'),
    status: evictionFilingStatusEnum('status').notNull().default('filed'),
    source: evictionFilingSourceEnum('source').notNull(),
    rawJson: jsonb('raw_json').$type<Record<string, unknown>>(),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    uniqueIndex('eviction_filings_case_source_idx').on(t.caseNumber, t.source),
    index('eviction_filings_filed_at_idx').on(t.filedAt),
    index('eviction_filings_status_idx').on(t.status),
  ],
);

export type EvictionFiling = typeof evictionFilings.$inferSelect;
export type NewEvictionFiling = typeof evictionFilings.$inferInsert;
