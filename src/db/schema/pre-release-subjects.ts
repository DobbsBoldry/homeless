/**
 * SUBP-005 — pre_release_subjects table.
 *
 * Synthetic individual-record data for the reentry pathway. Per
 * [ADR 0009](docs/adr/0009-ky-doc-reentry-data-sharing-privacy-contract.md),
 * persistence here is gated at runtime by an active KY DOC DSA
 * (`partner_agreements` row with `kind='dsa'`, `agency='ky_doc'`,
 * `terms.individual_records_authorized=true`, `terms.no_recidivism_prediction_attestation=true`).
 * The schema models that structurally — every read / write goes through the
 * subp domain's `requireKyDocIndividualRecords()` helper, which fail-closes
 * on missing or unauthorized DSA.
 *
 * Bounded data flow: subjects whose projected release date falls outside
 * the agreement's `pre_release_window_days` are not ingested in the first
 * place; subjects that age past 7 days post-release without a warm handoff
 * are deleted by the daily Inngest sweep. That is the contract from ADR 0009
 * § 5.1 — encoded in software, not just policy.
 *
 * PHI fence: until KY DOC BAA closes, only synthetic data may land here.
 * The seed generator (`scripts/gen-synthetic-pre-release.ts`) honors that.
 */
import { date, index, jsonb, pgTable, text, timestamp, uuid } from 'drizzle-orm/pg-core';
import { preReleaseSubjectStatusEnum, preReleaseTypeEnum } from './enums';
import { partnerOrgs } from './partner-orgs';
import { users } from './users';

/**
 * Structured pre-release supports payload — mirrors the categories KY DOC's
 * Reentry Services Branch tracks for transition planning. Stored as JSONB
 * so the structure can evolve without schema churn; reads should validate
 * via `subp/pre-release-supports.ts`.
 *
 * `housing_intent` — what KY DOC has documented for housing on day-of-release.
 * `employment_plan` — pre-release employment commitment (Tier-3 reentry programs).
 * `medicaid_status` — Medicaid resumption progress (suspended during incarceration).
 * `treatment_continuity` — substance-use / mental-health continuity-of-care plan.
 * `family_connection` — documented family-connection plan (a strong reentry predictor).
 *
 * Notably absent: any field about prior offenses, sentence length, or
 * disciplinary history. Per ADR 0009 § 2 those are excluded from scope.
 */
export type PreReleaseSupports = {
  housing_intent: 'unknown' | 'none' | 'in_progress' | 'documented' | 'confirmed';
  employment_plan: 'unknown' | 'none' | 'searching' | 'committed';
  medicaid_status: 'unknown' | 'suspended' | 'resumption_filed' | 'resumed';
  treatment_continuity: 'unknown' | 'not_applicable' | 'none' | 'planned' | 'in_place';
  family_connection: 'unknown' | 'none' | 'in_progress' | 'documented';
};

export const preReleaseSubjects = pgTable(
  'pre_release_subjects',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    /**
     * KY DOC partner_org under whose DSA this row was ingested. Used by the
     * runtime gate in `subp/kydoc-gate.ts` to look up the active agreement.
     * ON DELETE RESTRICT — never silently drop rows when an agency is
     * removed; admin must terminate the DSA explicitly first.
     */
    kyDocPartnerOrgId: uuid('ky_doc_partner_org_id')
      .notNull()
      .references(() => partnerOrgs.id, { onDelete: 'restrict' }),
    /**
     * Synthetic KY DOC inmate ID (string, no encoding assumptions).
     * Real KY DOC inmate IDs will replace these post-BAA / post-integration.
     */
    kyDocInmateId: text('ky_doc_inmate_id').notNull(),
    /** Synthetic name fields — synthetic data only until KY DOC BAA closes. */
    legalFirstName: text('legal_first_name').notNull(),
    legalLastName: text('legal_last_name').notNull(),
    /** Date of birth — required for caseworker identification at warm handoff. */
    dateOfBirth: date('date_of_birth').notNull(),
    /**
     * Projected release date. The pre-release-window-sweep job computes
     * days-until-release from this and `now()`; subjects whose projected
     * release falls outside the agreement's window are deleted.
     */
    projectedReleaseDate: date('projected_release_date').notNull(),
    releaseType: preReleaseTypeEnum('release_type').notNull(),
    /**
     * Designated reentry destination — the address / locality KY DOC has
     * recorded as the subject's intended post-release residence. For Sprint
     * 12 scope this is a free-text city/county/ZIP string; SUBP-005's gate
     * on Daviess County is enforced at synth-generation time, not via this
     * column.
     */
    designatedDestination: text('designated_destination').notNull(),
    /** Coalition caseworker assigned to coordinate warm handoff — nullable until paired. */
    assignedCaseworkerUserId: uuid('assigned_caseworker_user_id').references(() => users.id, {
      onDelete: 'set null',
    }),
    supportsInPlace: jsonb('supports_in_place').$type<PreReleaseSupports>().notNull(),
    status: preReleaseSubjectStatusEnum('status').notNull().default('active'),
    /**
     * Set when caseworker confirms the warm handoff was successfully completed
     * on or near release day. Subjects with a non-null `handed_off_at` are
     * exempt from the window-expiration sweep.
     */
    handedOffAt: timestamp('handed_off_at', { withTimezone: true }),
    notes: text('notes'),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    index('pre_release_subjects_partner_idx').on(t.kyDocPartnerOrgId),
    index('pre_release_subjects_caseworker_idx').on(t.assignedCaseworkerUserId),
    index('pre_release_subjects_status_idx').on(t.status),
    index('pre_release_subjects_release_date_idx').on(t.projectedReleaseDate),
  ],
);

export type PreReleaseSubject = typeof preReleaseSubjects.$inferSelect;
export type NewPreReleaseSubject = typeof preReleaseSubjects.$inferInsert;
