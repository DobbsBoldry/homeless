import { index, jsonb, pgTable, text, timestamp, uuid } from 'drizzle-orm/pg-core';
import { clientDocumentKindEnum, clientDocumentStatusEnum } from './enums';
import { users } from './users';

/**
 * CWT-021: client document upload + AI extraction.
 *
 * Phase-1 / synthetic-friendly model: text content is pasted (or
 * extracted client-side from a PDF) and stored as `content_md`.
 * Binary file storage waits for Supabase → S3 (post-BAA per the
 * BACKLOG); this row is the in-DB representation either way.
 *
 * The document is associated with a `synthetic_person_ref` (the
 * opaque coalition-wide identifier) — we never store the subject's
 * real name, just the document content the subject themselves
 * provided. Once the BAA closes and a real client model exists,
 * `synthetic_person_ref` becomes a FK to `clients.id`.
 *
 * `extracted_fields` is the structured Claude output, schema-
 * dependent on the document kind. Stored as jsonb so we can iterate
 * the prompt without a migration each time.
 */
export const clientDocuments = pgTable(
  'client_documents',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    syntheticPersonRef: text('synthetic_person_ref'),
    kind: clientDocumentKindEnum('kind').notNull(),
    /** Display label — e.g., "Sarah's KY ID" or "Lease 2024-09". */
    label: text('label').notNull(),
    /** Plain-text body the AI extracts from. May be PDF-extracted text. */
    contentMd: text('content_md').notNull(),
    /** Schema-dependent structured Claude output. */
    extractedFields: jsonb('extracted_fields').$type<Record<string, unknown>>(),
    /** Free-form note the AI returns alongside the structured fields. */
    extractionNotes: text('extraction_notes'),
    /** Anthropic model id used for the extraction (versioned record). */
    extractionModel: text('extraction_model'),
    status: clientDocumentStatusEnum('status').notNull().default('uploaded'),
    /** Caseworker / staff who uploaded. */
    uploadedByUserId: uuid('uploaded_by_user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'restrict' }),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    index('client_documents_kind_idx').on(t.kind),
    index('client_documents_status_idx').on(t.status),
    index('client_documents_uploaded_by_idx').on(t.uploadedByUserId),
    index('client_documents_synthetic_ref_idx').on(t.syntheticPersonRef),
  ],
);

export type ClientDocument = typeof clientDocuments.$inferSelect;
export type NewClientDocument = typeof clientDocuments.$inferInsert;
