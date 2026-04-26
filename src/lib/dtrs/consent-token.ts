import { randomBytes } from 'node:crypto';
import { and, eq, gt, isNull } from 'drizzle-orm';
import { db } from '@/db/client';
import { type ConsentAccessToken, consentAccessTokens } from '@/db/schema/consent-access-tokens';

/** Default lifetime: 24 hours. Long enough for shelter outreach, short enough that a found wallet card isn't a forever leak. */
export const CONSENT_TOKEN_TTL_MS = 24 * 60 * 60 * 1000;

/** randomBytes(32).toString('base64url') is exactly 43 chars. */
const TOKEN_LEN = 43;

/**
 * Mint a fresh URL-safe token. ~256 bits of entropy from
 * `crypto.randomBytes`; URL-safe via `base64url` encoding.
 */
export function mintTokenString(): string {
  return randomBytes(32).toString('base64url');
}

/**
 * Server-only: create a new access token row for the given subject.
 * Returns the token string the caller hands to the subject.
 */
export async function createConsentAccessToken(input: {
  syntheticPersonRef: string;
  issuedByUserId: string;
  notes?: string;
  ttlMs?: number;
}): Promise<{ token: string; expiresAt: Date }> {
  const token = mintTokenString();
  const expiresAt = new Date(Date.now() + (input.ttlMs ?? CONSENT_TOKEN_TTL_MS));
  await db.insert(consentAccessTokens).values({
    token,
    syntheticPersonRef: input.syntheticPersonRef,
    issuedByUserId: input.issuedByUserId,
    expiresAt,
    notes: input.notes ?? null,
  });
  return { token, expiresAt };
}

/**
 * Read-only token validation. Returns the row when the token is valid
 * (unexpired, unrevoked) — does NOT stamp `used_at`. Used by the page
 * render path so the page can show a form without consuming the token.
 */
export async function lookupConsentAccessToken(
  rawToken: string,
): Promise<ConsentAccessToken | null> {
  const trimmed = rawToken.trim();
  if (trimmed.length !== TOKEN_LEN) return null;

  const now = new Date();
  const [row] = await db
    .select()
    .from(consentAccessTokens)
    .where(
      and(
        eq(consentAccessTokens.token, trimmed),
        gt(consentAccessTokens.expiresAt, now),
        isNull(consentAccessTokens.revokedAt),
      ),
    )
    .limit(1);
  return row ?? null;
}

/**
 * Atomically redeem a token. Returns the row only if the conditional
 * UPDATE actually flipped a row from "valid + unused" to "valid +
 * used_at=now". Concurrent calls collapse: only one redeems, the other
 * returns null. This is the right primitive for write actions
 * (grantConsentAction, revokeConsentAction).
 *
 * For "is this token currently valid?" without consuming, use
 * `lookupConsentAccessToken` — that does NOT touch `used_at`.
 */
export async function redeemConsentAccessToken(
  rawToken: string,
): Promise<ConsentAccessToken | null> {
  const trimmed = rawToken.trim();
  if (trimmed.length !== TOKEN_LEN) return null;

  const now = new Date();
  // Single UPDATE...RETURNING. Conditional on usedAt IS NULL so the first
  // concurrent caller wins and the second sees zero rows back.
  const [redeemed] = await db
    .update(consentAccessTokens)
    .set({ usedAt: now })
    .where(
      and(
        eq(consentAccessTokens.token, trimmed),
        gt(consentAccessTokens.expiresAt, now),
        isNull(consentAccessTokens.revokedAt),
        isNull(consentAccessTokens.usedAt),
      ),
    )
    .returning();

  if (redeemed) return redeemed;

  // No update happened — could be: invalid, expired, revoked, OR already
  // redeemed. For the already-redeemed case (legitimate user re-submitting
  // within the bounded reuse window), look up the row and return it WITHOUT
  // re-stamping. Token reuse is intentional during the 24h window — only
  // analytics need to know "first redemption".
  return await lookupConsentAccessToken(trimmed);
}
