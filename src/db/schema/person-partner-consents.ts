import { pgTable, text, timestamp, uniqueIndex, uuid } from 'drizzle-orm/pg-core';
import { partnerOrgs } from './partner-orgs';

/**
 * Per-(synthetic_person, partner_org) consent state. Phase-1 stub:
 * synthetic data, served by /p/[ref]/consent for Persona 8's
 * "see what you have on me, revoke at any time" surface.
 *
 * `synthetic_person_ref` is OPAQUE (matches partner_service_events).
 * The platform never holds the mapping to a real identity — that
 * lives with the data-trust steward post-Phase-2.
 *
 * Revocations record `revoked_at` rather than deleting; preserves
 * the audit trail. Re-granting clears `revoked_at`.
 */
export const personPartnerConsents = pgTable(
  'person_partner_consents',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    syntheticPersonRef: text('synthetic_person_ref').notNull(),
    partnerOrgId: uuid('partner_org_id')
      .notNull()
      .references(() => partnerOrgs.id, { onDelete: 'cascade' }),
    grantedAt: timestamp('granted_at', { withTimezone: true }).notNull().defaultNow(),
    revokedAt: timestamp('revoked_at', { withTimezone: true }),
    notes: text('notes'),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    uniqueIndex('person_partner_consents_unique_idx').on(t.syntheticPersonRef, t.partnerOrgId),
  ],
);

export type PersonPartnerConsent = typeof personPartnerConsents.$inferSelect;
export type NewPersonPartnerConsent = typeof personPartnerConsents.$inferInsert;
