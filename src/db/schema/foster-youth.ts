/**
 * SUBP-001 — foster_youth table.
 *
 * Synthetic individual-record data for the foster aging-out countdown
 * pathway. Per [ADR 0006](docs/adr/0006-dcbs-data-sharing-privacy-contract.md),
 * persistence here is gated at runtime by an active DCBS DSA
 * (`partner_agreements` row with `kind='dsa'`, `agency='dcbs'`,
 * `terms.individual_records_authorized=true`). The schema models that
 * structurally — every read / write goes through the subp domain's
 * `gateForDcbsDsa()` helper, which fail-closes on missing or unauthorized
 * DSA.
 *
 * PHI fence: until DCBS BAA closes, only synthetic data may land here.
 * The seed generator (`scripts/gen-synthetic-foster-youth.ts`) honors that.
 */
import { date, index, integer, jsonb, pgTable, text, timestamp, uuid } from 'drizzle-orm/pg-core';
import { fosterPlacementTypeEnum, fosterYouthStatusEnum } from './enums';
import { partnerOrgs } from './partner-orgs';
import { users } from './users';

/**
 * Structured "supports in place" payload for each youth — mirrors the
 * categories called out in 42 U.S.C. § 677 (Chafee) independent-living
 * planning. Stored as JSONB so the structure can evolve without schema
 * churn; reads should validate via subp/supports-in-place.ts.
 */
export type SupportsInPlace = {
  housing_plan: 'unknown' | 'none' | 'in_progress' | 'documented';
  medicaid_extension: 'unknown' | 'not_filed' | 'drafted' | 'submitted' | 'approved';
  education_plan: 'unknown' | 'none' | 'high_school' | 'post_secondary_enrolled';
  employment_plan: 'unknown' | 'none' | 'searching' | 'employed';
};

export const fosterYouth = pgTable(
  'foster_youth',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    /**
     * DCBS partner_org under whose DSA this row was ingested. Used by the
     * runtime gate in `subp/dcbs-gate.ts` to look up the active agreement.
     * ON DELETE RESTRICT — never silently drop rows when an agency is
     * removed; admin must terminate the DSA explicitly first.
     */
    dcbsPartnerOrgId: uuid('dcbs_partner_org_id')
      .notNull()
      .references(() => partnerOrgs.id, { onDelete: 'restrict' }),
    /**
     * Synthetic DCBS case number (string, no encoding assumptions).
     * Real DCBS case numbers will replace these post-BAA / post-integration.
     */
    dcbsCaseId: text('dcbs_case_id').notNull(),
    /** Synthetic / pre-BAA name fields — synthetic data only until ESUC-002 lifts the PHI fence. */
    legalFirstName: text('legal_first_name').notNull(),
    legalLastName: text('legal_last_name').notNull(),
    /** Date of birth — required for the aging-out countdown engine. */
    dateOfBirth: date('date_of_birth').notNull(),
    placementType: fosterPlacementTypeEnum('placement_type').notNull(),
    placementChangesCount: integer('placement_changes_count').notNull().default(0),
    /** Coalition caseworker assigned to the youth — nullable until paired. */
    assignedCaseworkerUserId: uuid('assigned_caseworker_user_id').references(() => users.id, {
      onDelete: 'set null',
    }),
    supportsInPlace: jsonb('supports_in_place').$type<SupportsInPlace>().notNull(),
    status: fosterYouthStatusEnum('status').notNull().default('active'),
    notes: text('notes'),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    index('foster_youth_dcbs_partner_idx').on(t.dcbsPartnerOrgId),
    index('foster_youth_assigned_caseworker_idx').on(t.assignedCaseworkerUserId),
    index('foster_youth_status_idx').on(t.status),
    index('foster_youth_dob_idx').on(t.dateOfBirth),
  ],
);

export type FosterYouth = typeof fosterYouth.$inferSelect;
export type NewFosterYouth = typeof fosterYouth.$inferInsert;
