import { createHash, randomBytes } from 'node:crypto';

/**
 * DTRS-014a-1 — academic-partner invitation tokens.
 *
 * Mirrors the `consent_access_tokens` opaque-token pattern, but stores only a
 * SHA-256 *hash* of the token at rest (the raw token is shown once, in the
 * invite link) — invitations grant a role, so we don't keep the live secret in
 * the DB. The pure helpers here (hash + redeemability) are unit-tested; the
 * query layer handles persistence + the atomic redeem.
 */

/** 7-day lifetime — long enough to accept, short enough to bound exposure. */
export const PARTNER_INVITE_TTL_MS = 7 * 24 * 60 * 60 * 1000;

/** base64url of 32 random bytes = 43 chars, ~256 bits of entropy. */
const TOKEN_LEN = 43;

/** Mint a fresh URL-safe invite token (the raw secret handed to the invitee). */
export function mintInviteToken(): string {
  return randomBytes(32).toString('base64url');
}

/** SHA-256 hex of a raw token — what we persist and look up by. */
export function hashInviteToken(rawToken: string): string {
  return createHash('sha256').update(rawToken.trim()).digest('hex');
}

/** Shape of the fields that determine whether an invitation can still be redeemed. */
export interface InvitationRedeemability {
  expiresAt: Date;
  redeemedAt: Date | null;
  revokedAt: Date | null;
}

/**
 * Pure check: is this invitation redeemable as of `now`? An invitation is
 * redeemable only when it is unredeemed, unrevoked, and unexpired.
 */
export function isInvitationRedeemable(inv: InvitationRedeemability, now: Date): boolean {
  if (inv.redeemedAt !== null) return false;
  if (inv.revokedAt !== null) return false;
  if (inv.expiresAt.getTime() <= now.getTime()) return false;
  return true;
}

/** Quick shape guard for a raw token before hitting the DB. */
export function looksLikeInviteToken(raw: string): boolean {
  return raw.trim().length === TOKEN_LEN;
}
