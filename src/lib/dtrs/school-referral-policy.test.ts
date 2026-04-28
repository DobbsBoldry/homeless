/**
 * Unit tests for PRVN-003 school-referral policy gate and M-V validator.
 *
 * Pure-function tests — no DB connection required.
 */
import { describe, expect, it } from 'vitest';
import type { SchoolReferral } from '@/db/schema/school-referrals';
import { canAccessSchoolReferral, validateMcKinneyVentoBasis } from './school-referral-policy';

// ---------------------------------------------------------------------------
// Fixtures
// ---------------------------------------------------------------------------

const baseReferral = (
  overrides: Partial<SchoolReferral> = {},
): Pick<SchoolReferral, 'id' | 'status'> => ({
  id: 'aaaa0000-aaaa-aaaa-aaaa-000000000001',
  status: 'received',
  ...overrides,
});

// ---------------------------------------------------------------------------
// validateMcKinneyVentoBasis
// ---------------------------------------------------------------------------

describe('validateMcKinneyVentoBasis', () => {
  it('accepts a valid M-V referral with shelter_placement', () => {
    const result = validateMcKinneyVentoBasis({
      housingSituation: 'Family is currently staying in a car.',
      servicesRequested: ['shelter_placement', 'case_management'],
    });
    expect(result.valid).toBe(true);
  });

  it('accepts rental_assistance as a qualifying housing service', () => {
    const result = validateMcKinneyVentoBasis({
      housingSituation: 'Doubled up with relatives after eviction.',
      servicesRequested: ['rental_assistance'],
    });
    expect(result.valid).toBe(true);
  });

  it('rejects when only transportation is requested (not housing-related)', () => {
    const result = validateMcKinneyVentoBasis({
      housingSituation: 'Family is unstably housed.',
      servicesRequested: ['transportation'],
    });
    expect(result.valid).toBe(false);
    if (!result.valid) expect(result.reason).toMatch(/housing-related/i);
  });

  it('rejects when only school_supplies is requested (not housing-related)', () => {
    const result = validateMcKinneyVentoBasis({
      housingSituation: 'Living in a motel.',
      servicesRequested: ['school_supplies'],
    });
    expect(result.valid).toBe(false);
    if (!result.valid) expect(result.reason).toMatch(/housing-related/i);
  });

  it('rejects when services_requested is empty', () => {
    const result = validateMcKinneyVentoBasis({
      housingSituation: 'Unstably housed.',
      servicesRequested: [],
    });
    expect(result.valid).toBe(false);
    if (!result.valid) expect(result.reason).toMatch(/at least one service/i);
  });

  it('rejects when housing_situation is too short (< 5 chars)', () => {
    const result = validateMcKinneyVentoBasis({
      housingSituation: 'Car',
      servicesRequested: ['shelter_placement'],
    });
    expect(result.valid).toBe(false);
    if (!result.valid) expect(result.reason).toMatch(/housing situation/i);
  });

  it('allows mixed services when at least one is housing-related', () => {
    const result = validateMcKinneyVentoBasis({
      housingSituation: 'Family sleeping in vehicle, needs immediate help.',
      servicesRequested: ['transportation', 'shelter_placement', 'school_supplies'],
    });
    expect(result.valid).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// canAccessSchoolReferral
// ---------------------------------------------------------------------------

describe('canAccessSchoolReferral', () => {
  it('allows caseworker with any referral', () => {
    const result = canAccessSchoolReferral(
      { userId: 'user-cw-001', role: 'caseworker' },
      baseReferral(),
    );
    expect(result.allow).toBe(true);
    expect(result.requireDisclosureLog).toBe(true);
    expect(result.basis).not.toBeNull();
  });

  it('allows ed_coordinator', () => {
    const result = canAccessSchoolReferral(
      { userId: 'user-ed-001', role: 'ed_coordinator' },
      baseReferral(),
    );
    expect(result.allow).toBe(true);
    expect(result.requireDisclosureLog).toBe(true);
  });

  it('allows admin', () => {
    const result = canAccessSchoolReferral(
      { userId: 'user-admin-001', role: 'admin' },
      baseReferral(),
    );
    expect(result.allow).toBe(true);
    expect(result.requireDisclosureLog).toBe(true);
  });

  it('denies attorney', () => {
    const result = canAccessSchoolReferral(
      { userId: 'user-atty-001', role: 'attorney' },
      baseReferral(),
    );
    expect(result.allow).toBe(false);
    expect(result.basis).toBeNull();
    expect(result.requireDisclosureLog).toBe(false);
  });

  it('denies shelter_staff', () => {
    const result = canAccessSchoolReferral(
      { userId: 'user-shelter-001', role: 'shelter_staff' },
      baseReferral(),
    );
    expect(result.allow).toBe(false);
  });

  it('denies pending role', () => {
    const result = canAccessSchoolReferral(
      { userId: 'user-pending-001', role: 'pending' },
      baseReferral(),
    );
    expect(result.allow).toBe(false);
  });
});
