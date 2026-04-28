import { describe, expect, it } from 'vitest';
import {
  assertValidTransition,
  isEligibleForExtension,
  isValidTransition,
  validateApplicationPayload,
} from './medicaid-extension';

// ---------------------------------------------------------------------------
// isEligibleForExtension
// ---------------------------------------------------------------------------

describe('isEligibleForExtension', () => {
  it('eligible: youth aged 19, was in foster care at 18', () => {
    const result = isEligibleForExtension(
      { dateOfBirth: '2007-04-28', status: 'aged_out', inFosterCareAt18: true },
      '2026-04-28',
    );
    expect(result.eligible).toBe(true);
  });

  it('ineligible: still under 18', () => {
    const result = isEligibleForExtension(
      { dateOfBirth: '2009-04-28', status: 'active', inFosterCareAt18: true },
      '2026-04-28',
    );
    expect(result.eligible).toBe(false);
    if (!result.eligible) expect(result.reasons).toContain('under_18');
  });

  it('eligible exactly on the 18th birthday (extension begins)', () => {
    const result = isEligibleForExtension(
      { dateOfBirth: '2008-04-28', status: 'aged_out', inFosterCareAt18: true },
      '2026-04-28',
    );
    expect(result.eligible).toBe(true);
  });

  it('ineligible: over 26', () => {
    const result = isEligibleForExtension(
      { dateOfBirth: '1999-04-28', status: 'exited', inFosterCareAt18: true },
      '2026-04-28',
    );
    expect(result.eligible).toBe(false);
    if (!result.eligible) expect(result.reasons).toContain('over_25');
  });

  it('ineligible: not in foster care at 18', () => {
    const result = isEligibleForExtension(
      { dateOfBirth: '2007-04-28', status: 'aged_out', inFosterCareAt18: false },
      '2026-04-28',
    );
    expect(result.eligible).toBe(false);
    if (!result.eligible) expect(result.reasons).toContain('not_in_foster_care_at_18');
  });

  it('returns multiple reasons when multiple gates fail', () => {
    const result = isEligibleForExtension(
      { dateOfBirth: '2009-04-28', status: 'active', inFosterCareAt18: false },
      '2026-04-28',
    );
    expect(result.eligible).toBe(false);
    if (!result.eligible) {
      expect(result.reasons).toContain('under_18');
      expect(result.reasons).toContain('not_in_foster_care_at_18');
    }
  });
});

// ---------------------------------------------------------------------------
// State transitions
// ---------------------------------------------------------------------------

describe('isValidTransition', () => {
  it('drafted → submitted is allowed', () => {
    expect(isValidTransition('drafted', 'submitted')).toBe(true);
  });

  it('drafted → withdrawn is allowed', () => {
    expect(isValidTransition('drafted', 'withdrawn')).toBe(true);
  });

  it('drafted → approved is NOT allowed (no skipping)', () => {
    expect(isValidTransition('drafted', 'approved')).toBe(false);
  });

  it('submitted → approved / denied / withdrawn are allowed', () => {
    expect(isValidTransition('submitted', 'approved')).toBe(true);
    expect(isValidTransition('submitted', 'denied')).toBe(true);
    expect(isValidTransition('submitted', 'withdrawn')).toBe(true);
  });

  it('submitted → drafted is NOT allowed (no re-opening)', () => {
    expect(isValidTransition('submitted', 'drafted')).toBe(false);
  });

  it('approved is terminal — no outbound transitions', () => {
    expect(isValidTransition('approved', 'denied')).toBe(false);
    expect(isValidTransition('approved', 'withdrawn')).toBe(false);
    expect(isValidTransition('approved', 'drafted')).toBe(false);
  });

  it('denied → withdrawn allowed (caseworker can withdraw a denial)', () => {
    expect(isValidTransition('denied', 'withdrawn')).toBe(true);
  });

  it('withdrawn is terminal', () => {
    expect(isValidTransition('withdrawn', 'drafted')).toBe(false);
    expect(isValidTransition('withdrawn', 'approved')).toBe(false);
  });
});

describe('assertValidTransition', () => {
  it('throws on invalid transition with helpful message', () => {
    expect(() => assertValidTransition('drafted', 'approved')).toThrow(
      /Invalid medicaid_extension status transition: drafted → approved/,
    );
    expect(() => assertValidTransition('drafted', 'approved')).toThrow(
      /Allowed from drafted: submitted, withdrawn/,
    );
  });

  it('does not throw on valid transition', () => {
    expect(() => assertValidTransition('drafted', 'submitted')).not.toThrow();
  });

  it('throws clearly when from-state is terminal', () => {
    expect(() => assertValidTransition('approved', 'denied')).toThrow(
      /Allowed from approved: \(none — terminal\)/,
    );
  });
});

// ---------------------------------------------------------------------------
// Payload validation
// ---------------------------------------------------------------------------

const validPayload = {
  in_foster_care_at_18: true,
  student_status: 'high_school',
  employment_status: 'part_time',
  current_address_synthetic: '123 Synthetic Lane, Owensboro, KY',
};

describe('validateApplicationPayload', () => {
  it('accepts a valid payload', () => {
    const result = validateApplicationPayload(validPayload);
    expect(result.in_foster_care_at_18).toBe(true);
  });

  it('rejects non-object', () => {
    expect(() => validateApplicationPayload(null)).toThrow('must be an object');
  });

  it('rejects non-boolean in_foster_care_at_18', () => {
    expect(() =>
      validateApplicationPayload({ ...validPayload, in_foster_care_at_18: 'yes' }),
    ).toThrow('in_foster_care_at_18 must be a boolean');
  });

  it('rejects invalid student_status', () => {
    expect(() => validateApplicationPayload({ ...validPayload, student_status: 'phd' })).toThrow(
      'student_status must be one of',
    );
  });

  it('rejects invalid employment_status', () => {
    expect(() =>
      validateApplicationPayload({ ...validPayload, employment_status: 'self_employed' }),
    ).toThrow('employment_status must be one of');
  });

  it('rejects empty current_address_synthetic', () => {
    expect(() =>
      validateApplicationPayload({ ...validPayload, current_address_synthetic: '' }),
    ).toThrow('current_address_synthetic is required');
  });

  it('rejects caseworker_notes longer than 2000 chars', () => {
    expect(() =>
      validateApplicationPayload({
        ...validPayload,
        caseworker_notes: 'x'.repeat(2001),
      }),
    ).toThrow('2 000 chars');
  });

  it('strips extra keys', () => {
    const result = validateApplicationPayload({
      ...validPayload,
      malicious: 'extra',
    });
    expect(result).not.toHaveProperty('malicious');
  });
});
