/**
 * COOR-012 — handoff context reader tests.
 *
 * Covers the pure consent validator and the summarizeScope helper. The
 * full DB-driven loadHandoffContext path is intentionally not exercised
 * here — the gate logic it composes is unit-tested via this validator
 * plus the queries-mock pattern in handoff.test.ts.
 */

import { describe, expect, it } from 'vitest';
import { summarizeScope, validateConsentForRead } from './handoff-context';

describe('validateConsentForRead', () => {
  const baseInput = {
    consentId: 'consent-1',
    acceptedAt: new Date('2026-05-01T12:00:00Z'),
    syntheticPersonRef: 'SYN-PERSON-001',
    toPartnerOrgId: 'org-to',
  };

  const baseConsent = {
    id: 'consent-1',
    syntheticPersonRef: 'SYN-PERSON-001',
    partnerOrgId: 'org-to',
    grantedAt: new Date('2026-04-15T12:00:00Z'),
    revokedAt: null as Date | null,
  };

  it('allows when consent matches and predates accept', () => {
    expect(validateConsentForRead(baseInput, baseConsent)).toEqual({ allowed: true });
  });

  it('denies consent_missing when handoff has no consent_id', () => {
    const result = validateConsentForRead({ ...baseInput, consentId: null }, baseConsent);
    expect(result).toEqual({ allowed: false, reason: 'consent_missing' });
  });

  it('denies consent_missing when consent row is gone', () => {
    const result = validateConsentForRead(baseInput, null);
    expect(result).toEqual({ allowed: false, reason: 'consent_missing' });
  });

  it('denies consent_revoked when revoked_at is set', () => {
    const result = validateConsentForRead(baseInput, {
      ...baseConsent,
      revokedAt: new Date('2026-04-20T12:00:00Z'),
    });
    expect(result).toEqual({ allowed: false, reason: 'consent_revoked' });
  });

  it('denies consent_missing when person ref does not match', () => {
    const result = validateConsentForRead(baseInput, {
      ...baseConsent,
      syntheticPersonRef: 'SYN-PERSON-OTHER',
    });
    expect(result).toEqual({ allowed: false, reason: 'consent_missing' });
  });

  it('denies consent_missing when consent is for a different org', () => {
    const result = validateConsentForRead(baseInput, {
      ...baseConsent,
      partnerOrgId: 'org-other',
    });
    expect(result).toEqual({ allowed: false, reason: 'consent_missing' });
  });

  it('denies consent_pre_dates_accept when consent was granted after accept', () => {
    // The receiver accepted on 2026-05-01; this consent was granted later.
    // That suggests a revoke-then-regrant flow that should re-trigger
    // accept rather than silently re-authorise the prior accept.
    const result = validateConsentForRead(baseInput, {
      ...baseConsent,
      grantedAt: new Date('2026-05-02T00:00:00Z'),
    });
    expect(result).toEqual({ allowed: false, reason: 'consent_pre_dates_accept' });
  });

  it('allows when consent grant exactly equals accept timestamp', () => {
    const result = validateConsentForRead(baseInput, {
      ...baseConsent,
      grantedAt: new Date(baseInput.acceptedAt!),
    });
    expect(result).toEqual({ allowed: true });
  });

  it('skips the pre-dates check when handoff has no acceptedAt yet', () => {
    // Should never happen for a status='accepted' handoff in practice, but
    // guard the validator against bad input.
    const result = validateConsentForRead(
      { ...baseInput, acceptedAt: null },
      { ...baseConsent, grantedAt: new Date('2030-01-01T00:00:00Z') },
    );
    expect(result).toEqual({ allowed: true });
  });
});

describe('summarizeScope', () => {
  it('marks each kind present in the scope', () => {
    expect(summarizeScope(['intakes', 'consents'])).toEqual({
      intakes: true,
      case_notes: false,
      service_events: false,
      consents: true,
    });
  });

  it('returns all-false for empty scope', () => {
    expect(summarizeScope([])).toEqual({
      intakes: false,
      case_notes: false,
      service_events: false,
      consents: false,
    });
  });
});
