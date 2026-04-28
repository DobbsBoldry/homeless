/**
 * SUBP-007 — school-stability scoring tests.
 *
 * Pure function — no DB, no clocks. Treat the higher tiers (high /
 * critical) as the "we want to alert the caseworker" buckets and
 * verify boundary conditions.
 */

import { describe, expect, it } from 'vitest';
import {
  computeSchoolStabilityRisk,
  type FamilyStabilityInput,
  type SchoolStabilityRisk,
} from './family-stability';

const baseInput: FamilyStabilityInput = {
  childrenCount: 1,
  housingStatus: 'doubled_up',
  schoolOfOriginId: null,
  currentSchoolId: null,
  midSchoolYear: false,
  anyChildMckinneyVentoEnrolled: true,
};

describe('computeSchoolStabilityRisk', () => {
  it('returns critical when housing is unsheltered with school-age children', () => {
    const r = computeSchoolStabilityRisk({
      ...baseInput,
      housingStatus: 'unsheltered',
    });
    expect(r.risk).toBe('critical');
    expect(r.reasons).toContain('housing_unsheltered');
  });

  it('returns high when school changed mid-year and no McKinney-Vento on file', () => {
    const r = computeSchoolStabilityRisk({
      ...baseInput,
      schoolOfOriginId: 'school-a',
      currentSchoolId: 'school-b',
      midSchoolYear: true,
      anyChildMckinneyVentoEnrolled: false,
    });
    expect(r.risk).toBe('high');
    expect(r.reasons).toContain('school_changed_mid_year');
    expect(r.reasons).toContain('no_mckinney_vento_protection');
  });

  it('returns moderate when school changed but McKinney-Vento is on file (transport protected)', () => {
    const r = computeSchoolStabilityRisk({
      ...baseInput,
      schoolOfOriginId: 'school-a',
      currentSchoolId: 'school-b',
      midSchoolYear: true,
      anyChildMckinneyVentoEnrolled: true,
    });
    expect(r.risk).toBe('moderate');
    expect(r.reasons).toContain('school_changed_mid_year');
    expect(r.reasons).toContain('mckinney_vento_active');
  });

  it('returns moderate for shelter housing even with stable school', () => {
    const r = computeSchoolStabilityRisk({
      ...baseInput,
      housingStatus: 'shelter',
      schoolOfOriginId: 'school-a',
      currentSchoolId: 'school-a',
    });
    expect(r.risk).toBe('moderate');
    expect(r.reasons).toContain('housing_shelter');
  });

  it('returns low when stably housed with stable school', () => {
    const r = computeSchoolStabilityRisk({
      ...baseInput,
      housingStatus: 'stably_housed',
      schoolOfOriginId: 'school-a',
      currentSchoolId: 'school-a',
    });
    expect(r.risk).toBe('low');
  });

  it('returns low when no children (degenerate but defined)', () => {
    const r = computeSchoolStabilityRisk({
      ...baseInput,
      childrenCount: 0,
      housingStatus: 'doubled_up',
    });
    expect(r.risk).toBe('low');
    expect(r.reasons).toContain('no_school_age_children');
  });

  it('upgrades to critical when both unsheltered AND mid-year school change', () => {
    const r = computeSchoolStabilityRisk({
      ...baseInput,
      housingStatus: 'unsheltered',
      schoolOfOriginId: 'school-a',
      currentSchoolId: 'school-b',
      midSchoolYear: true,
    });
    expect(r.risk).toBe('critical');
    // Both signals present in the reason set
    expect(r.reasons).toEqual(
      expect.arrayContaining(['housing_unsheltered', 'school_changed_mid_year']),
    );
  });

  it('returns moderate for hotel housing', () => {
    const r = computeSchoolStabilityRisk({
      ...baseInput,
      housingStatus: 'hotel',
      schoolOfOriginId: 'school-a',
      currentSchoolId: 'school-a',
    });
    expect(r.risk).toBe('moderate');
    expect(r.reasons).toContain('housing_hotel');
  });

  it('result is deterministic (pure function)', () => {
    const r1 = computeSchoolStabilityRisk(baseInput);
    const r2 = computeSchoolStabilityRisk(baseInput);
    expect(r1).toEqual(r2);
  });

  it('exhaustively maps housing → some non-low risk for any non-stable status', () => {
    const nonStable: Array<FamilyStabilityInput['housingStatus']> = [
      'doubled_up',
      'shelter',
      'unsheltered',
      'hotel',
    ];
    for (const status of nonStable) {
      const r: SchoolStabilityRisk = computeSchoolStabilityRisk({
        ...baseInput,
        housingStatus: status,
      });
      expect(r.risk).not.toBe('low');
    }
  });
});
