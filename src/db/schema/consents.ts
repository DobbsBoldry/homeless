import { index, jsonb, pgTable, text, timestamp, uuid } from 'drizzle-orm/pg-core';
import { consentChannelEnum, consentTypeEnum } from './enums';

/**
 * Consent records for individuals to share PHI within the coalition, receive
 * SMS communication, etc. Phase 0 captured the bare shape; DTRS-001 adds
 * the state machine on top: granted → revoked OR granted → expired,
 * scoped to specific partner orgs and data classes, versioned by the
 * consent text the subject saw.
 *
 * Append-only in spirit: revocations are recorded by setting revoked_at,
 * NOT by deleting the row. Re-granting after a revocation creates a NEW
 * row so the historical state is queryable forever.
 *
 * State is computed (not stored): see `consentState` in
 * `src/lib/dtrs/consent.ts`. Storing computed state risks drift between
 * the column and the wall-clock check against expires_at.
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
    /**
     * Version of the consent text the subject was shown. Bump
     * `CURRENT_CONSENT_VERSION` and `consentTextFor(...)` together.
     * A row whose `consent_version` is older than the current version
     * is treated as still-valid (we don't auto-revoke) but flagged in
     * the dashboard as needing a re-prompt.
     */
    consentVersion: text('consent_version').notNull().default('2026-04-1'),
    /** Specific partner orgs this consent covers; null = coalition-wide. */
    scopePartnerIds: jsonb('scope_partner_ids').$type<string[] | null>(),
    /**
     * Data classes the subject opted into; null = all. Phase-1 vocabulary
     * is intentionally short: 'identity', 'health', 'housing_history',
     * 'service_events'. Wider taxonomy is a follow-up once the FAG
     * weighs in (see DTRS-005 advisor session).
     */
    scopeDataClasses: jsonb('scope_data_classes').$type<string[] | null>(),
    /** Plain-language signature text typed by the subject ("Sarah J", "X"). */
    signatureText: text('signature_text'),
    /** Optional expiry. null = no expiration; coalition can re-prompt at will. */
    expiresAt: timestamp('expires_at', { withTimezone: true }),
    grantedAt: timestamp('granted_at', { withTimezone: true }).notNull().defaultNow(),
    revokedAt: timestamp('revoked_at', { withTimezone: true }),
    notes: text('notes'),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    index('consents_subject_idx').on(t.subjectExternalId),
    index('consents_type_idx').on(t.consentType),
    index('consents_expires_at_idx').on(t.expiresAt),
  ],
);

export type Consent = typeof consents.$inferSelect;
export type NewConsent = typeof consents.$inferInsert;
