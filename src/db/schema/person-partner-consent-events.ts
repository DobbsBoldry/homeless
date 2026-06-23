import { index, pgEnum, pgTable, text, timestamp, uuid } from 'drizzle-orm/pg-core';
import { personPartnerConsents } from './person-partner-consents';
import { users } from './users';

/**
 * INDC-019: append-only event log for person/partner consent state.
 *
 * The parent `person_partner_consents` row carries CURRENT state only
 * (latest `granted_at`, `revoked_at` when revoked). This child table keeps
 * the full history so "first granted on date X" survives a re-grant —
 * matching the preserve-history discipline of `audit_log` and the versioned
 * `consents` table, rather than mutating state in place (the mismatch
 * INDC-017's PR #250 review flagged).
 *
 * `actor_user_id` is nullable: the public consent surface (`/p/[ref]/consent`)
 * has no signed-in user, so grant/revoke/re-grant events from there record a
 * null actor (the audit_log row carries the `via: public_consent_panel` tag).
 */
export const personPartnerConsentEventTypeEnum = pgEnum('person_partner_consent_event_type', [
  'granted',
  'revoked',
]);

export type PersonPartnerConsentEventType =
  (typeof personPartnerConsentEventTypeEnum.enumValues)[number];

export const personPartnerConsentEvents = pgTable(
  'person_partner_consent_events',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    consentId: uuid('consent_id')
      .notNull()
      .references(() => personPartnerConsents.id, { onDelete: 'cascade' }),
    eventType: personPartnerConsentEventTypeEnum('event_type').notNull(),
    eventAt: timestamp('event_at', { withTimezone: true }).notNull().defaultNow(),
    /** Null for public-surface (token-authed, no signed-in user) events. */
    actorUserId: uuid('actor_user_id').references(() => users.id, { onDelete: 'set null' }),
    notes: text('notes'),
  },
  (t) => [index('person_partner_consent_events_consent_idx').on(t.consentId)],
);

export type PersonPartnerConsentEvent = typeof personPartnerConsentEvents.$inferSelect;
export type NewPersonPartnerConsentEvent = typeof personPartnerConsentEvents.$inferInsert;
