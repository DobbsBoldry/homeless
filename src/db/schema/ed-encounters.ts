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
import { edEncounterSourceEnum, housingStatusEnum } from './enums';

/**
 * One row per ED visit. patient_id is OPAQUE — a synthetic prefix today
 * (SYN-PAT-...), an opaque hash from Owensboro Health's Epic FHIR feed
 * later (post-BAA). The platform never stores or asks for real patient
 * names, MRNs, or contact info; the cross-org coordination layer (#242)
 * uses these opaque refs to link service events without ever exposing
 * identity.
 *
 * Append-only by convention. Encounter facts don't get edited; corrections
 * happen by writing a new row pointing at the same encounter_external_id.
 */
export const edEncounters = pgTable(
  'ed_encounters',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    /** Opaque patient identifier — synthetic prefix today, hash post-BAA. */
    patientId: text('patient_id').notNull(),
    /** Source-system encounter id (de-duplicates re-ingests of same encounter). */
    encounterExternalId: text('encounter_external_id').notNull(),
    arrivedAt: timestamp('arrived_at', { withTimezone: true }).notNull(),
    dischargedAt: timestamp('discharged_at', { withTimezone: true }),
    chiefComplaint: text('chief_complaint').notNull(),
    /** ED disposition — admitted, discharged-home, ama, transfer, etc. */
    disposition: text('disposition').notNull(),
    housingStatus: housingStatusEnum('housing_status').notNull().default('unknown'),
    /** Cents — admit cost or charge if available. Optional. */
    chargeCents: integer('charge_cents'),
    notes: text('notes'),
    rawJson: jsonb('raw_json').$type<Record<string, unknown> | null>(),
    source: edEncounterSourceEnum('source').notNull().default('synthetic'),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    uniqueIndex('ed_encounters_external_idx').on(t.encounterExternalId, t.source),
    index('ed_encounters_patient_idx').on(t.patientId),
    index('ed_encounters_arrived_idx').on(t.arrivedAt),
    index('ed_encounters_housing_idx').on(t.housingStatus),
  ],
);

export type EdEncounter = typeof edEncounters.$inferSelect;
export type NewEdEncounter = typeof edEncounters.$inferInsert;
