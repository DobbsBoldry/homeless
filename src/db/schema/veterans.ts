/**
 * SUBP-006a — veterans table (veteran pathway: identification + triage routing).
 *
 * First slice of the veteran pathway. Synthetic / manually-curated records
 * only: a veteran is either VA-documentation-confirmed or self-reported and
 * then caseworker-verified. Eligibility is DERIVED from those two fields (see
 * `src/lib/subp/veteran-eligibility.ts`) rather than stored as a separate
 * boolean, so there is one source of truth for the rule.
 *
 * Out of scope for 006a (lands in 006b/006c, gated by the VA HUD-VASH DSA from
 * DTRS-015): the live HUD-VASH voucher feed, voucher matching, and VFW
 * referral packets. There is intentionally no partner-org FK or DSA gate here
 * — 006a does not ingest VA records, it tracks caseworker-curated flags.
 *
 * PHI fence: synthetic data only until the relevant BAA closes.
 */
import { boolean, index, pgTable, text, timestamp, uuid } from 'drizzle-orm/pg-core';
import { veteranEligibilitySourceEnum, veteranStatusEnum } from './enums';
import { users } from './users';

export const veterans = pgTable(
  'veterans',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    /** Opaque cross-cutting person key (matches partner_service_events / consents). */
    syntheticPersonRef: text('synthetic_person_ref').notNull(),
    /** Synthetic name fields — synthetic data only until BAA closes. */
    legalFirstName: text('legal_first_name').notNull(),
    legalLastName: text('legal_last_name').notNull(),
    /** Branch of service, when known (Army / Navy / etc.). Free text, nullable. */
    branchOfService: text('branch_of_service'),
    /**
     * How veteran status was established. `va_confirmed` = VA documentation on
     * file (eligible outright). `self_reported` = subject reported it; requires
     * `caseworker_verified` before counting as eligible.
     */
    eligibilitySource: veteranEligibilitySourceEnum('eligibility_source').notNull(),
    /**
     * Caseworker confirmation of a self-reported claim. Toggled manually with a
     * reason note (audit-logged). Ignored for `va_confirmed` rows (already
     * eligible). See `isVeteranEligible` for the derivation.
     */
    caseworkerVerified: boolean('caseworker_verified').notNull().default(false),
    /** Coalition caseworker coordinating this veteran — nullable until paired. */
    assignedCaseworkerUserId: uuid('assigned_caseworker_user_id').references(() => users.id, {
      onDelete: 'set null',
    }),
    status: veteranStatusEnum('status').notNull().default('active'),
    notes: text('notes'),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    index('veterans_caseworker_idx').on(t.assignedCaseworkerUserId),
    index('veterans_status_idx').on(t.status),
    index('veterans_synthetic_ref_idx').on(t.syntheticPersonRef),
  ],
);

export type Veteran = typeof veterans.$inferSelect;
export type NewVeteran = typeof veterans.$inferInsert;
