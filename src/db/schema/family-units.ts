/**
 * SUBP-007 — family_units + family_children tables.
 *
 * Synthetic individual-record data for the McKinney-Vento families w/
 * children pathway. Builds on PRVN-003 / PRVN-004 (school-referral
 * receiver + closed-loop reporting from Sprint 9) and reads the active
 * FERPA-fork agreement (DTRS-010, ADR 0005) when surfacing school cross-
 * links.
 *
 * Pre-flight risk per the AC: polymorphic entry_signal FKs are not a
 * thing in Postgres. Shipped here is the simpler shape — `entry_signal`
 * enum + `entry_signal_id` text (soft reference). Cross-link rendering
 * is a read-side concern in the route layer.
 *
 * PHI fence: synthetic-only. Names follow the cwt/esuc/subp pattern of
 * obviously synthetic last names (cf. `gen-synthetic-foster-youth.ts`'s
 * "Synthetic" surnames).
 */
import { date, index, integer, jsonb, pgTable, text, timestamp, uuid } from 'drizzle-orm/pg-core';
import {
  familyChildGradeBandEnum,
  familyEntrySignalEnum,
  familyHousingStatusEnum,
  familyUnitStatusEnum,
} from './enums';
import { partnerOrgs } from './partner-orgs';
import { users } from './users';

export const familyUnits = pgTable(
  'family_units',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    /** Synthetic primary caregiver name. Pre-BAA: synthetic only. */
    primaryCaregiverName: text('primary_caregiver_name').notNull(),
    householdSize: integer('household_size').notNull(),
    childrenCount: integer('children_count').notNull(),
    status: familyUnitStatusEnum('status').notNull().default('active'),
    entrySignal: familyEntrySignalEnum('entry_signal').notNull(),
    /**
     * Opaque text reference to the originating record (eviction filing
     * id, ED encounter id, school referral id, SMS conversation id).
     * Soft FK — not enforced at the DB layer. Rendering layer joins
     * on `entry_signal` + `entry_signal_id` per case.
     */
    entrySignalId: text('entry_signal_id'),
    currentHousingStatus: familyHousingStatusEnum('current_housing_status').notNull(),
    /** Coalition caseworker assigned to the family — nullable until paired. */
    assignedCaseworkerUserId: uuid('assigned_caseworker_user_id').references(() => users.id, {
      onDelete: 'set null',
    }),
    /**
     * Receiving school district (when known). Used by the school-
     * stability scoring engine. References `partner_orgs` (school type).
     */
    receivingSchoolDistrictId: uuid('receiving_school_district_id').references(
      () => partnerOrgs.id,
      { onDelete: 'set null' },
    ),
    notes: text('notes'),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    index('family_units_status_idx').on(t.status),
    index('family_units_entry_signal_idx').on(t.entrySignal),
    index('family_units_assigned_caseworker_idx').on(t.assignedCaseworkerUserId),
    index('family_units_school_district_idx').on(t.receivingSchoolDistrictId),
  ],
);

export type FamilyUnit = typeof familyUnits.$inferSelect;
export type NewFamilyUnit = typeof familyUnits.$inferInsert;

/**
 * Per-child record. McKinney-Vento status drives the school-stability
 * scoring; current_school_id is the school the child is currently
 * enrolled in (may differ from the school-of-origin when families are
 * mid-housing-transition — that's the gap the scoring engine flags).
 */
export const familyChildren = pgTable(
  'family_children',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    familyUnitId: uuid('family_unit_id')
      .notNull()
      .references(() => familyUnits.id, { onDelete: 'cascade' }),
    /** Synthetic child identifier (used in URLs / refs; never the legal name). */
    childRef: text('child_ref').notNull(),
    /** Date of birth — synthetic. Used to infer grade-band and age-of-majority. */
    dateOfBirth: date('date_of_birth'),
    /** School the child is currently enrolled in (FK to partner_orgs school type). */
    currentSchoolId: uuid('current_school_id').references(() => partnerOrgs.id, {
      onDelete: 'set null',
    }),
    /** McKinney-Vento identification flag — set per child, not per family. */
    enrolledInMckinneyVento: jsonb('enrolled_in_mckinney_vento')
      .$type<{ flagged: boolean; flaggedAt: string | null; source: string | null }>()
      .notNull()
      .default({ flagged: false, flaggedAt: null, source: null }),
    gradeBand: familyChildGradeBandEnum('grade_band').notNull(),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    index('family_children_family_idx').on(t.familyUnitId),
    index('family_children_school_idx').on(t.currentSchoolId),
    index('family_children_grade_idx').on(t.gradeBand),
  ],
);

export type FamilyChild = typeof familyChildren.$inferSelect;
export type NewFamilyChild = typeof familyChildren.$inferInsert;
