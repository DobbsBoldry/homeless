/**
 * SUBP-002 — medicaid_extension_applications.
 *
 * One per (youth, attempt) — a youth may have multiple applications over
 * time (withdrawn → re-drafted, denied → re-submitted with new evidence).
 * The caseworker UI shows the most recent.
 *
 * Status flow (enforced at the query layer, not just here):
 *   drafted → submitted → approved | denied
 *   any → withdrawn
 *
 * "Skipping" states (drafted → approved, etc.) is rejected by
 * `assertValidTransition` in `src/lib/subp/medicaid-extension.ts`.
 *
 * Synthetic until the kynect (KY Medicaid eligibility portal) integration
 * lands as a follow-up; `kynect_reference` is filled with synthetic IDs
 * via the seed for now.
 */

import { index, jsonb, pgTable, text, timestamp, uuid } from 'drizzle-orm/pg-core';
import { medicaidExtensionStatusEnum } from './enums';
import { fosterYouth } from './foster-youth';
import { users } from './users';

/**
 * Structured payload captured at draft time. Mirrors the TEAMKY Former
 * Foster Youth Medicaid extension form's load-bearing fields. Stored as
 * JSONB so the application form's structure can evolve without schema
 * churn; reads validate via `validateApplicationPayload`.
 */
export type MedicaidExtensionPayload = {
  /** Was the youth in foster care in KY at age 18? Required eligibility check. */
  in_foster_care_at_18: boolean;
  /** Current student status — affects priority routing, not eligibility. */
  student_status: 'unknown' | 'not_in_school' | 'high_school' | 'post_secondary';
  /** Current employment status — affects priority routing, not eligibility. */
  employment_status: 'unknown' | 'unemployed' | 'part_time' | 'full_time';
  /** Current address (synthetic; will be replaced post-PHI-fence-lift). */
  current_address_synthetic: string;
  /** Free-text notes from caseworker (no PHI; max 2 000 chars at app layer). */
  caseworker_notes?: string;
};

export const medicaidExtensionApplications = pgTable(
  'medicaid_extension_applications',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    youthId: uuid('youth_id')
      .notNull()
      .references(() => fosterYouth.id, { onDelete: 'cascade' }),
    status: medicaidExtensionStatusEnum('status').notNull().default('drafted'),
    /** Synthetic kynect reference until the kynect integration lands. */
    kynectReference: text('kynect_reference'),
    applicationPayload: jsonb('application_payload').$type<MedicaidExtensionPayload>().notNull(),
    /** Caseworker who created the draft. */
    draftedByUserId: uuid('drafted_by_user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'restrict' }),
    draftedAt: timestamp('drafted_at', { withTimezone: true }).notNull().defaultNow(),
    submittedAt: timestamp('submitted_at', { withTimezone: true }),
    decisionAt: timestamp('decision_at', { withTimezone: true }),
    /** Free-text reason from kynect / caseworker on decision. */
    decisionReason: text('decision_reason'),
    /** When status became 'withdrawn' — separate from decision_at. */
    withdrawnAt: timestamp('withdrawn_at', { withTimezone: true }),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    index('medicaid_extension_applications_youth_idx').on(t.youthId),
    index('medicaid_extension_applications_status_idx').on(t.status),
    index('medicaid_extension_applications_drafted_at_idx').on(t.draftedAt),
  ],
);

export type MedicaidExtensionApplication = typeof medicaidExtensionApplications.$inferSelect;
export type NewMedicaidExtensionApplication = typeof medicaidExtensionApplications.$inferInsert;
