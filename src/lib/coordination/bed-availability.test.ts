import { describe, expect, it } from 'vitest';
import { freeBeds, matchesFilter, occupancyRate } from './bed-availability';

const baseShelter = {
  capacity: 60,
  currentOccupancy: 42,
  acceptsMen: true,
  acceptsWomen: true,
  acceptsFamilies: false,
  petFriendly: false,
  sudFriendly: false,
};

describe('freeBeds', () => {
  it('returns capacity minus occupancy', () => {
    expect(freeBeds({ capacity: 60, currentOccupancy: 42 })).toBe(18);
  });

  it('clamps to 0 if occupancy exceeds capacity', () => {
    expect(freeBeds({ capacity: 10, currentOccupancy: 12 })).toBe(0);
  });

  it('returns 0 when at capacity', () => {
    expect(freeBeds({ capacity: 10, currentOccupancy: 10 })).toBe(0);
  });
});

describe('occupancyRate', () => {
  it('computes the fraction in [0, 1]', () => {
    expect(occupancyRate({ capacity: 100, currentOccupancy: 25 })).toBe(0.25);
  });

  it('treats capacity 0 as full', () => {
    expect(occupancyRate({ capacity: 0, currentOccupancy: 0 })).toBe(1);
  });
});

describe('matchesFilter', () => {
  it('matches every active shelter when filter is empty', () => {
    expect(matchesFilter(baseShelter, {})).toBe(true);
  });

  it('rejects men-only request against a women-only shelter', () => {
    expect(matchesFilter({ ...baseShelter, acceptsMen: false }, { population: 'men' })).toBe(false);
  });

  it('matches families against a family-accepting shelter', () => {
    expect(
      matchesFilter({ ...baseShelter, acceptsFamilies: true }, { population: 'families' }),
    ).toBe(true);
  });

  it('honors pet-friendly filter', () => {
    expect(matchesFilter(baseShelter, { petFriendly: true })).toBe(false);
    expect(matchesFilter({ ...baseShelter, petFriendly: true }, { petFriendly: true })).toBe(true);
  });

  it('honors sud-friendly filter', () => {
    expect(matchesFilter(baseShelter, { sudFriendly: true })).toBe(false);
  });

  it('rejects when minFreeBeds is not met', () => {
    expect(matchesFilter({ ...baseShelter, currentOccupancy: 60 }, { minFreeBeds: 1 })).toBe(false);
    expect(matchesFilter({ ...baseShelter, currentOccupancy: 50 }, { minFreeBeds: 1 })).toBe(true);
  });
});
