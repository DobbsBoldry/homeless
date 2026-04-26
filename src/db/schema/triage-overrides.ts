import { index, integer, jsonb, pgTable, text, timestamp, uuid } from 'drizzle-orm/pg-core';
import { triageTierEnum } from './enums';
import { users } from './users';

/**
 * CWT-014: caseworker overrides on the rule-based triage
 * recommendation. Captured as a signal for Phase-2 ML retraining
 * and as an explainable audit trail of "the system said X but the
 * caseworker chose Y because Z."
 *
 * Stores the recommendation context (inputs + computed score + tier)
 * and what the caseworker actually picked. No client-identifying
 * data — `inputs_snapshot` carries household details (income,
 * household size, flags) but no name / address / synthetic_person_ref.
 */
export const triageOverrides = pgTable(
  'triage_overrides',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    /** Caseworker / admin who recorded the override. */
    actorUserId: uuid('actor_user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'restrict' }),
    /** Rule-engine output at the time of the override. */
    recommendedTier: triageTierEnum('recommended_tier').notNull(),
    recommendedScore: integer('recommended_score').notNull(),
    /** Tier the caseworker chose instead. May equal recommended (a confirm). */
    chosenTier: triageTierEnum('chosen_tier').notNull(),
    /** Free-form rationale; required when chosen != recommended. */
    overrideReason: text('override_reason'),
    /** Snapshot of TriageInputs at decision time, for retraining context. */
    inputsSnapshot: jsonb('inputs_snapshot').$type<Record<string, unknown>>().notNull(),
    /** Snapshot of factors[] from recommendTriageTier output. */
    recommendedFactors: jsonb('recommended_factors')
      .$type<Array<{ label: string; delta: number }>>()
      .notNull(),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    index('triage_overrides_actor_idx').on(t.actorUserId),
    index('triage_overrides_created_idx').on(t.createdAt),
    index('triage_overrides_recommended_idx').on(t.recommendedTier),
  ],
);

export type TriageOverride = typeof triageOverrides.$inferSelect;
export type NewTriageOverride = typeof triageOverrides.$inferInsert;
