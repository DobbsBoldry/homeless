import { describe, expect, it } from 'vitest';
import { describeVeteranEligibility, isVeteranEligible } from './veteran-eligibility';

describe('isVeteranEligible', () => {
  it('is eligible when VA-confirmed, regardless of caseworker verification', () => {
    expect(
      isVeteranEligible({ eligibilitySource: 'va_confirmed', caseworkerVerified: false }),
    ).toBe(true);
    expect(isVeteranEligible({ eligibilitySource: 'va_confirmed', caseworkerVerified: true })).toBe(
      true,
    );
  });

  it('is eligible when self-reported AND caseworker-verified', () => {
    expect(
      isVeteranEligible({ eligibilitySource: 'self_reported', caseworkerVerified: true }),
    ).toBe(true);
  });

  it('is NOT eligible when self-reported but unverified', () => {
    expect(
      isVeteranEligible({ eligibilitySource: 'self_reported', caseworkerVerified: false }),
    ).toBe(false);
  });
});

describe('describeVeteranEligibility', () => {
  it('labels VA-confirmed', () => {
    expect(
      describeVeteranEligibility({ eligibilitySource: 'va_confirmed', caseworkerVerified: false }),
    ).toBe('VA-confirmed');
  });

  it('labels self-reported by verification state', () => {
    expect(
      describeVeteranEligibility({ eligibilitySource: 'self_reported', caseworkerVerified: true }),
    ).toBe('Self-reported · verified');
    expect(
      describeVeteranEligibility({ eligibilitySource: 'self_reported', caseworkerVerified: false }),
    ).toBe('Self-reported · unverified');
  });
});
