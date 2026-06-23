import { describe, expect, it } from 'vitest';
import {
  hashInviteToken,
  isInvitationRedeemable,
  looksLikeInviteToken,
  mintInviteToken,
  PARTNER_INVITE_TTL_MS,
} from './partner-invite-token';

const at = (iso: string) => new Date(iso);

describe('mintInviteToken / looksLikeInviteToken', () => {
  it('mints a 43-char url-safe token that passes the shape guard', () => {
    const t = mintInviteToken();
    expect(t).toHaveLength(43);
    expect(t).toMatch(/^[A-Za-z0-9_-]+$/);
    expect(looksLikeInviteToken(t)).toBe(true);
  });

  it('mints distinct tokens', () => {
    expect(mintInviteToken()).not.toBe(mintInviteToken());
  });

  it('rejects wrong-length strings', () => {
    expect(looksLikeInviteToken('short')).toBe(false);
    expect(looksLikeInviteToken('')).toBe(false);
  });
});

describe('hashInviteToken', () => {
  it('is deterministic and trims input', () => {
    expect(hashInviteToken('abc')).toBe(hashInviteToken('abc'));
    expect(hashInviteToken('  abc  ')).toBe(hashInviteToken('abc'));
  });

  it('produces a 64-char hex digest that differs per token and is not the raw token', () => {
    const raw = mintInviteToken();
    const h = hashInviteToken(raw);
    expect(h).toMatch(/^[0-9a-f]{64}$/);
    expect(h).not.toBe(raw);
    expect(hashInviteToken(mintInviteToken())).not.toBe(h);
  });
});

describe('isInvitationRedeemable', () => {
  const now = at('2026-06-23T12:00:00Z');
  const future = at('2026-06-30T12:00:00Z');
  const past = at('2026-06-20T12:00:00Z');

  it('is redeemable when unredeemed, unrevoked, and unexpired', () => {
    expect(
      isInvitationRedeemable({ expiresAt: future, redeemedAt: null, revokedAt: null }, now),
    ).toBe(true);
  });

  it('is not redeemable once redeemed', () => {
    expect(
      isInvitationRedeemable({ expiresAt: future, redeemedAt: past, revokedAt: null }, now),
    ).toBe(false);
  });

  it('is not redeemable once revoked', () => {
    expect(
      isInvitationRedeemable({ expiresAt: future, redeemedAt: null, revokedAt: past }, now),
    ).toBe(false);
  });

  it('is not redeemable once expired (boundary = exclusive)', () => {
    expect(
      isInvitationRedeemable({ expiresAt: past, redeemedAt: null, revokedAt: null }, now),
    ).toBe(false);
    expect(isInvitationRedeemable({ expiresAt: now, redeemedAt: null, revokedAt: null }, now)).toBe(
      false,
    );
  });
});

describe('PARTNER_INVITE_TTL_MS', () => {
  it('is 7 days', () => {
    expect(PARTNER_INVITE_TTL_MS).toBe(7 * 24 * 60 * 60 * 1000);
  });
});
