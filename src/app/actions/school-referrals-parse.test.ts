/**
 * Unit tests for parseSchoolReferralForm — PRVN-003.
 *
 * Pure-function tests, no auth or DB required.
 */
import { describe, expect, it } from 'vitest';
import { parseSchoolReferralForm } from './school-referrals-parse';

function makeFormData(overrides: Record<string, string | string[]> = {}): FormData {
  const fd = new FormData();
  fd.set('partnerOrgId', 'org-uuid-001');
  fd.set('basis', 'mckinney_vento_authorization');
  fd.set('mvAttestationChecked', 'true');
  fd.set('studentFirstInitial', 'J');
  fd.set('guardianName', 'Maria Lopez');
  fd.set('guardianContact', '270-555-0101');
  fd.set(
    'housingSituation',
    'Family is currently sleeping in vehicle after losing their apartment.',
  );
  fd.append('servicesRequested', 'shelter_placement');
  fd.set('urgency', 'high');

  for (const [k, v] of Object.entries(overrides)) {
    if (k === 'servicesRequested') {
      fd.delete(k);
      const vals = Array.isArray(v) ? v : [v];
      for (const val of vals) fd.append(k, val);
    } else {
      fd.set(k, Array.isArray(v) ? v[0] : v);
    }
  }
  return fd;
}

describe('parseSchoolReferralForm — M-V basis', () => {
  it('accepts a valid M-V referral', () => {
    const r = parseSchoolReferralForm(makeFormData());
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.input.basis).toBe('mckinney_vento_authorization');
    expect(r.input.mvAuthorizationConfirmed).toBe(true);
    expect(r.input.consentSignedAt).toBeNull();
  });

  it('rejects when M-V attestation is not checked', () => {
    const r = parseSchoolReferralForm(makeFormData({ mvAttestationChecked: 'false' }));
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.error).toMatch(/attest/i);
  });

  it('rejects a student initial longer than 1 char', () => {
    const r = parseSchoolReferralForm(makeFormData({ studentFirstInitial: 'Jo' }));
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.error).toMatch(/initial/i);
  });

  it('rejects a non-letter student initial', () => {
    const r = parseSchoolReferralForm(makeFormData({ studentFirstInitial: '3' }));
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.error).toMatch(/initial/i);
  });

  it('rejects when partnerOrgId is missing', () => {
    const r = parseSchoolReferralForm(makeFormData({ partnerOrgId: '' }));
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.error).toMatch(/partner org/i);
  });

  it('rejects when no services are selected', () => {
    const r = parseSchoolReferralForm(makeFormData({ servicesRequested: [] }));
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.error).toMatch(/service/i);
  });

  it('rejects an unknown service value', () => {
    const r = parseSchoolReferralForm(makeFormData({ servicesRequested: ['illegal_service'] }));
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.error).toMatch(/Unknown service/i);
  });

  it('rejects invalid urgency value', () => {
    const r = parseSchoolReferralForm(makeFormData({ urgency: 'critical' }));
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.error).toMatch(/urgency/i);
  });

  it('treats empty notes as null', () => {
    const r = parseSchoolReferralForm(makeFormData({ notes: '   ' }));
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.input.notes).toBeNull();
  });

  it('rejects notes > 2000 characters', () => {
    const r = parseSchoolReferralForm(makeFormData({ notes: 'x'.repeat(2001) }));
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.error).toMatch(/2 000/);
  });

  it('accepts multiple services', () => {
    const r = parseSchoolReferralForm(
      makeFormData({
        servicesRequested: ['shelter_placement', 'rental_assistance', 'food_assistance'],
      }),
    );
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.input.servicesRequested).toHaveLength(3);
  });
});

describe('parseSchoolReferralForm — parental_consent basis', () => {
  function makeParentalFormData(overrides: Record<string, string | string[]> = {}): FormData {
    return makeFormData({
      basis: 'parental_consent',
      mvAttestationChecked: '',
      consentSignedAt: '2026-04-15',
      consentSignedMethod: 'in_person',
      ...overrides,
    });
  }

  it('accepts a valid parental consent referral', () => {
    const r = parseSchoolReferralForm(makeParentalFormData());
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.input.basis).toBe('parental_consent');
    expect(r.input.consentSignedAt).toBeInstanceOf(Date);
    expect(r.input.mvAuthorizationConfirmed).toBe(false);
  });

  it('rejects parental_consent when consentSignedAt is missing', () => {
    const r = parseSchoolReferralForm(makeParentalFormData({ consentSignedAt: '' }));
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.error).toMatch(/consent date/i);
  });

  it('rejects an invalid consent date', () => {
    const r = parseSchoolReferralForm(makeParentalFormData({ consentSignedAt: 'not-a-date' }));
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.error).toMatch(/invalid/i);
  });
});

describe('parseSchoolReferralForm — eligible_student_consent basis', () => {
  it('accepts eligible_student_consent with required fields', () => {
    const r = parseSchoolReferralForm(
      makeFormData({
        basis: 'eligible_student_consent',
        mvAttestationChecked: '',
        consentSignedAt: '2026-04-20',
        consentSignedMethod: 'web_form',
      }),
    );
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.input.basis).toBe('eligible_student_consent');
    expect(r.input.consentSignedAt).toBeInstanceOf(Date);
  });

  it('rejects eligible_student_consent without consentSignedAt', () => {
    const r = parseSchoolReferralForm(
      makeFormData({
        basis: 'eligible_student_consent',
        mvAttestationChecked: '',
        consentSignedAt: '',
      }),
    );
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.error).toMatch(/consent date/i);
  });
});
