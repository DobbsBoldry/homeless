import { describe, expect, it } from 'vitest';
import type { Consent } from '@/db/schema/consents';
import { consentCovers, consentNeedsRefresh, consentState } from './consent';
import { CURRENT_CONSENT_VERSION } from './consent-text';

const baseConsent = (overrides: Partial<Consent> = {}): Consent => ({
  id: '11111111-1111-1111-1111-111111111111',
  subjectExternalId: 'SYN-PERSON-001',
  consentType: 'phi_share_within_coalition',
  grantedVia: 'web_form',
  consentVersion: CURRENT_CONSENT_VERSION,
  scopePartnerIds: null,
  scopeDataClasses: null,
  signatureText: 'Sarah J',
  expiresAt: null,
  grantedAt: new Date('2026-01-01T00:00:00Z'),
  revokedAt: null,
  notes: null,
  createdAt: new Date('2026-01-01T00:00:00Z'),
  ...overrides,
});

const NOW = new Date('2026-04-26T12:00:00Z');

describe('consentState', () => {
  it('returns granted for an open-ended consent', () => {
    expect(consentState(baseConsent(), NOW)).toBe('granted');
  });

  it('returns revoked when revoked_at is set, even before any expiry', () => {
    expect(
      consentState(
        baseConsent({
          revokedAt: new Date('2026-02-01T00:00:00Z'),
          expiresAt: new Date('2027-01-01T00:00:00Z'),
        }),
        NOW,
      ),
    ).toBe('revoked');
  });

  it('returns expired when expires_at has passed', () => {
    const c = baseConsent({ expiresAt: new Date('2026-04-01T00:00:00Z') });
    expect(consentState(c, NOW)).toBe('expired');
  });

  it('still granted when expires_at is in the future', () => {
    const c = baseConsent({ expiresAt: new Date('2027-01-01T00:00:00Z') });
    expect(consentState(c, NOW)).toBe('granted');
  });

  it('revoked beats expired even if both timestamps are past', () => {
    expect(
      consentState(
        baseConsent({
          revokedAt: new Date('2026-03-01T00:00:00Z'),
          expiresAt: new Date('2026-02-01T00:00:00Z'),
        }),
        NOW,
      ),
    ).toBe('revoked');
  });
});

describe('consentCovers', () => {
  it('null scopes mean coalition-wide', () => {
    expect(consentCovers({ partnerOrgIds: null, dataClasses: null }, 'org1', 'health')).toBe(true);
  });

  it('rejects non-listed partners', () => {
    const scope = { partnerOrgIds: ['org1'], dataClasses: null };
    expect(consentCovers(scope, 'org2', 'identity')).toBe(false);
  });

  it('rejects non-listed data classes', () => {
    const scope = { partnerOrgIds: null, dataClasses: ['identity'] };
    expect(consentCovers(scope, 'org1', 'health')).toBe(false);
  });

  it('matches when both lists include the request', () => {
    const scope = { partnerOrgIds: ['org1', 'org2'], dataClasses: ['identity', 'health'] };
    expect(consentCovers(scope, 'org2', 'health')).toBe(true);
  });
});

describe('consentNeedsRefresh', () => {
  it('returns false for the current version', () => {
    expect(consentNeedsRefresh(baseConsent())).toBe(false);
  });

  it('returns true for an older version', () => {
    expect(consentNeedsRefresh(baseConsent({ consentVersion: '2025-01-1' }))).toBe(true);
  });
});
