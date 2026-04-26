import { index, integer, pgTable, text, timestamp, uniqueIndex, uuid } from 'drizzle-orm/pg-core';
import { evictionFilings } from './eviction-filings';

/**
 * Risk score for a filing, produced by the EVDT-009 Claude scoring service.
 *
 * One row per (filing_id, model_version). Re-scoring with the same prompt
 * version is a no-op (cache via the unique index). Bumping model_version
 * inserts a fresh row alongside the old one — useful for prompt-iteration
 * eval where we compare distributions across versions.
 */
export const evictionFilingRiskScores = pgTable(
  'eviction_filing_risk_scores',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    filingId: uuid('filing_id')
      .notNull()
      .references(() => evictionFilings.id, { onDelete: 'cascade' }),
    score: integer('score').notNull(), // 0-100
    rationale: text('rationale').notNull(),
    modelVersion: text('model_version').notNull(),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    uniqueIndex('risk_scores_filing_version_idx').on(t.filingId, t.modelVersion),
    index('risk_scores_filing_idx').on(t.filingId),
    index('risk_scores_score_idx').on(t.score),
  ],
);

export type EvictionFilingRiskScore = typeof evictionFilingRiskScores.$inferSelect;
export type NewEvictionFilingRiskScore = typeof evictionFilingRiskScores.$inferInsert;
