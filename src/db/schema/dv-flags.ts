import { index, pgTable, text, timestamp, uniqueIndex, uuid } from 'drizzle-orm/pg-core';

/**
 * DV abuser-blind registry (DTRS-004). One row per (synthetic_person_ref
 * OR phone number) that DV-trained staff have flagged as needing
 * location suppression in coalition queries.
 *
 * The threat model: an abuser obtains the survivor's new location
 * through a coalition partner's data leak (e.g. a leaked spreadsheet,
 * a screen-shared dashboard). This table is the application-level
 * choke point. Queries that surface addresses to non-attorney roles
 * must consult this table and redact. The OASIS shelter's location-
 * confidential model is the same pattern at the shelter level.
 *
 * Identifiers are opaque (`synthetic_person_ref`) or phone numbers in
 * E.164 form. We never store the survivor's name here — naming would
 * defeat the purpose. Reasoning behind the flag is captured in
 * `notes`, encrypted-at-rest by the DB engine.
 *
 * Flips:
 *   - `flag_set_at` is when the survivor was added.
 *   - `flag_cleared_at` non-null = the flag was lifted (e.g. after
 *     legal protective order resolution); rows are not deleted so
 *     audit trail survives.
 */
export const dvFlaggedPersons = pgTable(
  'dv_flagged_persons',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    /** Opaque ref OR E.164 phone number — whichever the partner uses. */
    subjectIdentifier: text('subject_identifier').notNull(),
    /** Brief, redacted-by-default justification (audit only). */
    notes: text('notes'),
    flagSetAt: timestamp('flag_set_at', { withTimezone: true }).notNull().defaultNow(),
    flagClearedAt: timestamp('flag_cleared_at', { withTimezone: true }),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    uniqueIndex('dv_flagged_persons_subject_idx').on(t.subjectIdentifier),
    index('dv_flagged_persons_set_at_idx').on(t.flagSetAt),
  ],
);

export type DvFlaggedPerson = typeof dvFlaggedPersons.$inferSelect;
export type NewDvFlaggedPerson = typeof dvFlaggedPersons.$inferInsert;
