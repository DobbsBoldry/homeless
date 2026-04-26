import { index, pgTable, text, timestamp, uuid } from 'drizzle-orm/pg-core';
import { consentChannelEnum, consentTypeEnum } from './enums';

/**
 * Consent records for individuals to share PHI within the coalition, receive
 * SMS communication, etc. Phase 0 captures the structure; client linkage
 * (subject_external_id -> a real clients.id) lands in a Phase 1 story when
 * the clients table exists and PHI flows are unlocked post-BAA.
 *
 * Append-only in spirit: revocations are recorded by setting revoked_at,
 * NOT by deleting the row.
 */
export const consents = pgTable(
  'consents',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    // External identifier for the subject — phone number, intake ID, etc.
    // Not a FK yet; will become a clients.id in Phase 1.
    subjectExternalId: text('subject_external_id').notNull(),
    consentType: consentTypeEnum('consent_type').notNull(),
    grantedVia: consentChannelEnum('granted_via').notNull(),
    grantedAt: timestamp('granted_at', { withTimezone: true }).notNull().defaultNow(),
    revokedAt: timestamp('revoked_at', { withTimezone: true }),
    notes: text('notes'),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    index('consents_subject_idx').on(t.subjectExternalId),
    index('consents_type_idx').on(t.consentType),
  ],
);

export type Consent = typeof consents.$inferSelect;
export type NewConsent = typeof consents.$inferInsert;
