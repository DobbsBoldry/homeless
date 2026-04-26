import { index, pgTable, text, timestamp, uniqueIndex, uuid } from 'drizzle-orm/pg-core';
import { users } from './users';

/**
 * Single-resource access tokens for the public consent surface
 * (`/p/[ref]/consent`). The opaque token is what the caseworker hands
 * the subject — typed into a phone or scanned from a QR code printed
 * on a wallet card. The token resolves server-side to a
 * `synthetic_person_ref` and an expiry; without a valid token, the
 * page returns 404 (don't even acknowledge the URL pattern).
 *
 * Single-use is the strict mode but disruptive in practice (caller
 * loses access after one click). Phase-1 default is "valid until
 * expiry" — a bounded reuse window where the subject can return to
 * the same link to check / change settings within (say) 24 hours.
 *
 * `used_at` records the first redemption so analytics can answer
 * "what % of distributed links were ever used?".
 */
export const consentAccessTokens = pgTable(
  'consent_access_tokens',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    /** The opaque random string handed to the subject. URL-safe, ≥32 bytes entropy. */
    token: text('token').notNull(),
    /** What ref the token maps to. Opaque per the existing convention. */
    syntheticPersonRef: text('synthetic_person_ref').notNull(),
    /** Caseworker who minted this token. NOT the subject. */
    issuedByUserId: uuid('issued_by_user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'restrict' }),
    expiresAt: timestamp('expires_at', { withTimezone: true }).notNull(),
    /** When the subject first redeemed the token (i.e. opened the page). */
    usedAt: timestamp('used_at', { withTimezone: true }),
    /** Optional: when the issuer revokes a token before expiry (lost wallet card, etc). */
    revokedAt: timestamp('revoked_at', { withTimezone: true }),
    notes: text('notes'),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    uniqueIndex('consent_access_tokens_token_idx').on(t.token),
    index('consent_access_tokens_ref_idx').on(t.syntheticPersonRef),
    index('consent_access_tokens_expires_idx').on(t.expiresAt),
  ],
);

export type ConsentAccessToken = typeof consentAccessTokens.$inferSelect;
export type NewConsentAccessToken = typeof consentAccessTokens.$inferInsert;
