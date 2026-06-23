/**
 * DTRS-014a-1 — academic-partner invitations.
 *
 * An admin mints an invitation for an external email; the raw token is shown
 * once (in the invite link) and only its SHA-256 hash is stored. The invitee
 * redeems it while signed in to receive the `academic_partner` role. Tokens
 * are single-use and expire 7 days after mint. Revoking sets `revoked_at`.
 */
import { index, pgTable, text, timestamp, uniqueIndex, uuid } from 'drizzle-orm/pg-core';
import { users } from './users';

export const partnerInvitations = pgTable(
  'partner_invitations',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    /** SHA-256 hex of the opaque token; the raw token is never stored. */
    tokenHash: text('token_hash').notNull(),
    invitedEmail: text('invited_email').notNull(),
    invitedByUserId: uuid('invited_by_user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'restrict' }),
    expiresAt: timestamp('expires_at', { withTimezone: true }).notNull(),
    redeemedAt: timestamp('redeemed_at', { withTimezone: true }),
    redeemedByUserId: uuid('redeemed_by_user_id').references(() => users.id, {
      onDelete: 'set null',
    }),
    revokedAt: timestamp('revoked_at', { withTimezone: true }),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    uniqueIndex('partner_invitations_token_hash_idx').on(t.tokenHash),
    index('partner_invitations_email_idx').on(t.invitedEmail),
  ],
);

export type PartnerInvitation = typeof partnerInvitations.$inferSelect;
export type NewPartnerInvitation = typeof partnerInvitations.$inferInsert;
