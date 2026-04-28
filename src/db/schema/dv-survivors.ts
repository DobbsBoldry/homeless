/**
 * SUBP-004 — dv_survivors table.
 *
 * Synthetic individual-record data for the DV survivor pathway. Per
 * [ADR 0007](docs/adr/0007-oasis-dv-survivor-privacy-contract.md), every
 * read / write goes through the subp domain's abuser-blind middleware
 * (`src/lib/subp/abuser-blind.ts`), which fail-closes when:
 *   1. No active OASIS DSA exists for the partner_org, OR
 *   2. The viewer is not the assigned coalition advocate (caseworker) and
 *      not an admin, OR
 *   3. The redaction_policy from the OASIS DSA suppresses the requested
 *      field.
 *
 * **Direct queries against this table outside `src/lib/subp/` are forbidden
 * by the boundary lint** — the middleware is the only authorized access
 * path. This is the cornerstone of the abuser-blind discipline (ADR 0007
 * § Decision rule 5: "no enumeration").
 *
 * No name field. No address field. No employer field. No anything that
 * could leak survivor location. Identifiers and routing-critical metadata
 * only. Anything richer is OASIS's responsibility, not the coalition's.
 *
 * PHI fence: until OASIS DSA closes for real, only synthetic data may
 * land here. The seed generator (`scripts/gen-synthetic-dv-survivors.ts`)
 * honors that.
 */
import { boolean, index, jsonb, pgTable, text, timestamp, uuid } from 'drizzle-orm/pg-core';
import { dvRiskTierEnum, dvSafetyEventTypeEnum, dvSurvivorStatusEnum } from './enums';
import { partnerOrgs } from './partner-orgs';
import { users } from './users';

/**
 * Structured needs assessment captured at intake. Categorical only — no
 * narrative. Stored as JSONB so the structure can evolve without schema
 * churn; reads should validate.
 */
export type DvNeedsAssessment = {
  housing: 'unknown' | 'none' | 'in_progress' | 'documented';
  legal: 'unknown' | 'none' | 'in_progress' | 'documented';
  childcare: 'unknown' | 'not_applicable' | 'none' | 'in_progress' | 'documented';
  employment: 'unknown' | 'none' | 'searching' | 'employed';
  mental_health: 'unknown' | 'none' | 'in_progress' | 'documented';
};

export const dvSurvivors = pgTable(
  'dv_survivors',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    /**
     * OASIS partner_org under whose DSA this row was ingested. Used by the
     * runtime gate in `subp/abuser-blind.ts` to look up the active OASIS
     * agreement and read its redaction_policy. ON DELETE RESTRICT — never
     * silently drop rows when an OASIS partner is removed; admin must
     * terminate the DSA explicitly first.
     */
    oasisPartnerOrgId: uuid('oasis_partner_org_id')
      .notNull()
      .references(() => partnerOrgs.id, { onDelete: 'restrict' }),
    /**
     * Synthetic OASIS case identifier (string, no encoding assumptions).
     * Real OASIS case numbers will replace these post-DSA / integration.
     */
    oasisCaseId: text('oasis_case_id').notNull(),
    enrolledAt: timestamp('enrolled_at', { withTimezone: true }).notNull().defaultNow(),
    status: dvSurvivorStatusEnum('status').notNull().default('active'),
    /**
     * Coalition advocate (caseworker role) assigned to this survivor.
     * Required for non-admin reads — see `isAuthorizedReader` in the
     * abuser-blind middleware. Nullable until paired (admin-only reads
     * during the unpaired window).
     */
    assignedAdvocateUserId: uuid('assigned_advocate_user_id').references(() => users.id, {
      onDelete: 'set null',
    }),
    /** True when OASIS has a written safety plan on file. Plan content is never persisted here. */
    safetyPlanOnFile: boolean('safety_plan_on_file').notNull().default(false),
    /** Last time OASIS confirmed the safety plan was reviewed/updated. */
    safetyPlanLastReviewedAt: timestamp('safety_plan_last_reviewed_at', { withTimezone: true }),
    needsAssessment: jsonb('needs_assessment').$type<DvNeedsAssessment>().notNull(),
    riskTier: dvRiskTierEnum('risk_tier').notNull().default('unknown'),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    index('dv_survivors_oasis_partner_idx').on(t.oasisPartnerOrgId),
    index('dv_survivors_assigned_advocate_idx').on(t.assignedAdvocateUserId),
    index('dv_survivors_status_idx').on(t.status),
    index('dv_survivors_risk_tier_idx').on(t.riskTier),
  ],
);

export type DvSurvivor = typeof dvSurvivors.$inferSelect;
export type NewDvSurvivor = typeof dvSurvivors.$inferInsert;

/**
 * Per-survivor safety-event log. Append-only by convention (audit-log-style).
 * Summary text is structured-categorical-friendly only — no narrative
 * content. Plan contents are never written here.
 */
export const dvSafetyEvents = pgTable(
  'dv_safety_events',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    survivorId: uuid('survivor_id')
      .notNull()
      .references(() => dvSurvivors.id, { onDelete: 'cascade' }),
    eventType: dvSafetyEventTypeEnum('event_type').notNull(),
    occurredAt: timestamp('occurred_at', { withTimezone: true }).notNull().defaultNow(),
    /** Coalition advocate / admin who recorded the event. SET NULL on user delete. */
    recordedByUserId: uuid('recorded_by_user_id').references(() => users.id, {
      onDelete: 'set null',
    }),
    /** Short categorical summary (e.g. "legal_referral_issued"); never narrative. */
    summary: text('summary').notNull(),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    index('dv_safety_events_survivor_idx').on(t.survivorId),
    index('dv_safety_events_occurred_idx').on(t.occurredAt),
    index('dv_safety_events_type_idx').on(t.eventType),
  ],
);

export type DvSafetyEvent = typeof dvSafetyEvents.$inferSelect;
export type NewDvSafetyEvent = typeof dvSafetyEvents.$inferInsert;
