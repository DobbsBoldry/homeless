import { randomBytes } from 'node:crypto';
import { and, eq, gt, isNull } from 'drizzle-orm';
import { db } from '@/db/client';
import { type ConsentAccessToken, consentAccessTokens } from '@/db/schema/consent-access-tokens';

/** Default lifetime: 24 hours. Long enough for shelter outreach, short enough that a found wallet card isn't a forever leak. */
export const CONSENT_TOKEN_TTL_MS = 24 * 60 * 60 * 1000;

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
 * Look up a token by its opaque string. Returns the row only if it's
 * unexpired AND not revoked; otherwise null. Side effect: stamps
 * `used_at` on first redemption so analytics see distinct redeems.
 */
export async function redeemConsentAccessToken(
  rawToken: string,
): Promise<ConsentAccessToken | null> {
  const trimmed = rawToken.trim();
  if (trimmed.length < 32 || trimmed.length > 64) return null;

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

  if (!row) return null;

  if (!row.usedAt) {
    await db
      .update(consentAccessTokens)
      .set({ usedAt: now })
      .where(eq(consentAccessTokens.id, row.id));
  }
  return row;
}
