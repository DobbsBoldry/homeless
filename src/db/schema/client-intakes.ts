import { index, integer, jsonb, pgTable, text, timestamp, uuid } from 'drizzle-orm/pg-core';
import { clientIntakeStatusEnum } from './enums';
import { users } from './users';

/**
 * CWT-019: voice-recorded intake.
 *
 * Phase-1 / synthetic-friendly: the caseworker records (or pastes) an
 * intake conversation; the browser transcribes via Web Speech API
 * (no upload of audio to a server); Claude Sonnet extracts a
 * structured profile from the transcript.
 *
 * We never store the audio. Transcript text is the artifact, plus the
 * structured profile fields the case-management UI can show. Real
 * client identity stays in `synthetic_person_ref` (opaque); the
 * profile's `client_first_name` is whatever the client said in the
 * conversation, which is fine pre-BAA against synthetic data and
 * gets re-considered post-BAA.
 */
export const clientIntakes = pgTable(
  'client_intakes',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    syntheticPersonRef: text('synthetic_person_ref'),
    /** Caseworker's short label for the intake. */
    label: text('label').notNull(),
    /** Final transcript text (caseworker can edit before extraction). */
    transcriptMd: text('transcript_md').notNull(),
    /** Recorded duration in seconds — purely metadata, audio isn't stored. */
    audioDurationSec: integer('audio_duration_sec'),
    /** Schema-keyed Claude extraction output. Populated when status='extracted'. */
    extractedProfile: jsonb('extracted_profile').$type<Record<string, unknown>>(),
    /** AI's freeform summary alongside the structured fields. */
    extractionNotes: text('extraction_notes'),
    /** Anthropic model id + prompt version stamp at extraction time. */
    extractionModel: text('extraction_model'),
    status: clientIntakeStatusEnum('status').notNull().default('recording'),
    recordedByUserId: uuid('recorded_by_user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'restrict' }),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    index('client_intakes_status_idx').on(t.status),
    index('client_intakes_recorded_by_idx').on(t.recordedByUserId),
    index('client_intakes_synthetic_ref_idx').on(t.syntheticPersonRef),
  ],
);

export type ClientIntake = typeof clientIntakes.$inferSelect;
export type NewClientIntake = typeof clientIntakes.$inferInsert;
