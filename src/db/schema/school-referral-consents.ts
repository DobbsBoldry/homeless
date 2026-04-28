/**
 * PRVN-003 — school_referral_consents table.
 *
 * One row per referral recording the legal basis under which student data
 * flowed. For McKinney-Vento authorization (statutory basis) signed_at,
 * consenter_name, and consent_text_version are all null — no consent was
 * collected; the statutory exception authorized the disclosure.
 *
 * Per ADR 0005 schema verbatim.
 */
import { index, jsonb, pgTable, text, timestamp, uuid } from 'drizzle-orm/pg-core';
import { schoolReferralBasisEnum } from './enums';
import { schoolReferrals } from './school-referrals';

export const schoolReferralConsents = pgTable(
  'school_referral_consents',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    referralId: uuid('referral_id')
      .notNull()
      .references(() => schoolReferrals.id, { onDelete: 'cascade' }),
    basis: schoolReferralBasisEnum('basis').notNull(),
    /**
     * 'parent', 'guardian', 'self' (eligible student).
     * Null when basis is mckinney_vento_authorization.
     */
    consenterRelationship: text('consenter_relationship'),
    /** Redacted in non-admin views. Null for M-V authorization. */
    consenterName: text('consenter_name'),
    /**
     * e.g. 'ferpa-parental-v1'.
     * Null when basis is mckinney_vento_authorization (no consent text shown).
     */
    consentTextVersion: text('consent_text_version'),
    /** Null when basis is mckinney_vento_authorization. */
    signedAt: timestamp('signed_at', { withTimezone: true }),
    /** 'in_person' | 'web_form' | 'phone'. Null for M-V authorization. */
    signedMethod: text('signed_method'),
    /** Which data classes, which partners, which time window. */
    scope: jsonb('scope').notNull().default({}),
    expiresAt: timestamp('expires_at', { withTimezone: true }),
    revokedAt: timestamp('revoked_at', { withTimezone: true }),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [index('school_referral_consents_referral_idx').on(t.referralId)],
);

export type SchoolReferralConsent = typeof schoolReferralConsents.$inferSelect;
export type NewSchoolReferralConsent = typeof schoolReferralConsents.$inferInsert;
