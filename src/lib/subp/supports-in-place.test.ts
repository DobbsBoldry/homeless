import { describe, expect, it } from 'vitest';
import { countSupportsInPlace, validateSupportsInPlace } from './supports-in-place';

const valid = {
  housing_plan: 'documented',
  medicaid_extension: 'submitted',
  education_plan: 'high_school',
  employment_plan: 'searching',
} as const;

describe('validateSupportsInPlace', () => {
  it('accepts a valid object', () => {
    const result = validateSupportsInPlace(valid);
    expect(result).toEqual(valid);
  });

  it('accepts all-unknown', () => {
    const result = validateSupportsInPlace({
      housing_plan: 'unknown',
      medicaid_extension: 'unknown',
      education_plan: 'unknown',
      employment_plan: 'unknown',
    });
    expect(result.housing_plan).toBe('unknown');
  });

  it('rejects non-object input', () => {
    expect(() => validateSupportsInPlace(null)).toThrow('must be an object');
    expect(() => validateSupportsInPlace('string')).toThrow('must be an object');
  });

  it('rejects invalid housing_plan', () => {
    expect(() => validateSupportsInPlace({ ...valid, housing_plan: 'maybe' })).toThrow(
      'housing_plan must be one of',
    );
  });

  it('rejects invalid medicaid_extension', () => {
    expect(() => validateSupportsInPlace({ ...valid, medicaid_extension: 'maybe' })).toThrow(
      'medicaid_extension must be one of',
    );
  });

  it('rejects invalid education_plan', () => {
    expect(() => validateSupportsInPlace({ ...valid, education_plan: 'phd' })).toThrow(
      'education_plan must be one of',
    );
  });

  it('rejects invalid employment_plan', () => {
    expect(() => validateSupportsInPlace({ ...valid, employment_plan: 'self_employed' })).toThrow(
      'employment_plan must be one of',
    );
  });
});

describe('countSupportsInPlace', () => {
  it('counts each documented/in-progress dimension', () => {
    expect(
      countSupportsInPlace({
        housing_plan: 'documented',
        medicaid_extension: 'submitted',
        education_plan: 'high_school',
        employment_plan: 'employed',
      }),
    ).toBe(4);
  });

  it('does not count unknown / none', () => {
    expect(
      countSupportsInPlace({
        housing_plan: 'unknown',
        medicaid_extension: 'not_filed',
        education_plan: 'none',
        employment_plan: 'none',
      }),
    ).toBe(0);
  });

  it('counts partials correctly', () => {
    expect(
      countSupportsInPlace({
        housing_plan: 'in_progress',
        medicaid_extension: 'drafted',
        education_plan: 'unknown',
        employment_plan: 'searching',
      }),
    ).toBe(3);
  });

  it('Medicaid `approved` counts (terminal-state, not just in-progress)', () => {
    expect(
      countSupportsInPlace({
        housing_plan: 'unknown',
        medicaid_extension: 'approved',
        education_plan: 'unknown',
        employment_plan: 'unknown',
      }),
    ).toBe(1);
  });
});
