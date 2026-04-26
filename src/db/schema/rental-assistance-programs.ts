import { boolean, index, integer, pgTable, text, timestamp, uuid } from 'drizzle-orm/pg-core';

/**
 * Static catalog of rental-assistance programs available to Daviess
 * County residents. Phase 1: hand-curated, no eligibility-matching
 * logic — every active program is shown on every case-detail page
 * with a 'verify with the agency' caveat. When the EVDT-014 follow-up
 * adds real eligibility data, matchAssistancePrograms() narrows by
 * filing facts (cause type, income proxy, household composition).
 */
export const rentalAssistancePrograms = pgTable(
  'rental_assistance_programs',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    name: text('name').notNull(),
    agency: text('agency').notNull(),
    phone: text('phone'),
    website: text('website'),
    eligibilitySummary: text('eligibility_summary').notNull(),
    /** Max one-time award in cents. Null = no documented cap. */
    maxAwardCents: integer('max_award_cents'),
    /** Source / vintage of the eligibility text — cite for the attorney. */
    sourceNote: text('source_note'),
    active: boolean('active').notNull().default(true),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [index('rental_assistance_programs_active_idx').on(t.active)],
);

export type RentalAssistanceProgram = typeof rentalAssistancePrograms.$inferSelect;
export type NewRentalAssistanceProgram = typeof rentalAssistancePrograms.$inferInsert;
