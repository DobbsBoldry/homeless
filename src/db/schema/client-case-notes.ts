import {
  type AnyPgColumn,
  boolean,
  index,
  pgTable,
  text,
  timestamp,
  uuid,
} from 'drizzle-orm/pg-core';
import { users } from './users';

/**
 * CWT-004 / CWT-005: caseworker case notes with version history.
 *
 * Each row is one version of one note. Edits create a NEW row whose
 * `parentNoteId` points at the prior version; the latest version is
 * the row in the chain that nothing points to. The generator (CWT-004)
 * writes the first draft with `draftedByAi=true` plus the model + prompt
 * stamps; subsequent caseworker edits land as new rows with
 * `draftedByAi=false` (the human is the author of the edit).
 *
 * Edits + rejections are training data per the CWT-005 brief. We
 * never overwrite a row, so the diff between v(n-1) and v(n) is
 * always reconstructable.
 *
 * `syntheticPersonRef` is opaque on this platform (matches the
 * person view + intake refs); real PHI lands post-BAA. No name fields
 * are stored on the case note itself.
 */
export const clientCaseNotes = pgTable(
  'client_case_notes',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    syntheticPersonRef: text('synthetic_person_ref').notNull(),
    bodyMd: text('body_md').notNull(),
    /** True iff this version was AI-drafted (first version of a chain
     *  almost always; subsequent edits typically false). */
    draftedByAi: boolean('drafted_by_ai').notNull().default(false),
    /** Model id at generation time, when AI-drafted. */
    aiModelId: text('ai_model_id'),
    /** Prompt version at generation time, when AI-drafted. */
    aiPromptVersion: text('ai_prompt_version'),
    /** Prior version of this note. null = first version of a chain. */
    parentNoteId: uuid('parent_note_id').references((): AnyPgColumn => clientCaseNotes.id, {
      onDelete: 'set null',
    }),
    createdByUserId: uuid('created_by_user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'restrict' }),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    index('client_case_notes_synthetic_ref_idx').on(t.syntheticPersonRef),
    index('client_case_notes_parent_idx').on(t.parentNoteId),
    index('client_case_notes_created_by_idx').on(t.createdByUserId),
  ],
);

export type ClientCaseNote = typeof clientCaseNotes.$inferSelect;
export type NewClientCaseNote = typeof clientCaseNotes.$inferInsert;
