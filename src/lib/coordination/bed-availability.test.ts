import { describe, expect, it } from 'vitest';
import {
  freeBeds,
  hasActiveFilter,
  matchesFilter,
  occupancyRate,
  parseBedFilterParams,
  validateBedCount,
} from './bed-availability';

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

describe('matchesFilter — query', () => {
  it('matches case-insensitively against searchableText', () => {
    expect(matchesFilter(baseShelter, { query: 'BENED' }, 'St. Benedict\u2019s — Owensboro')).toBe(
      true,
    );
  });

  it('rejects when query has no match', () => {
    expect(matchesFilter(baseShelter, { query: 'zzz' }, 'St. Benedict\u2019s')).toBe(false);
  });

  it('rejects when searchableText is undefined and query is set', () => {
    expect(matchesFilter(baseShelter, { query: 'foo' })).toBe(false);
  });

  it('ignores whitespace-only queries', () => {
    // parseBedFilterParams strips these; matchesFilter only acts on
    // non-empty queries (passes when query.trim() is empty).
    expect(matchesFilter(baseShelter, { query: '   ' })).toBe(true);
  });
});

describe('parseBedFilterParams', () => {
  it('returns empty filter for empty params', () => {
    expect(parseBedFilterParams({})).toEqual({});
  });

  it('parses a populated query string', () => {
    expect(
      parseBedFilterParams({
        population: 'families',
        pet: '1',
        sud: 'true',
        minFree: '3',
        q: '  Boulware ',
      }),
    ).toEqual({
      population: 'families',
      petFriendly: true,
      sudFriendly: true,
      minFreeBeds: 3,
      query: 'Boulware',
    });
  });

  it('drops invalid population values', () => {
    expect(parseBedFilterParams({ population: 'aliens' }).population).toBeUndefined();
  });

  it('drops zero / negative / non-numeric minFree', () => {
    expect(parseBedFilterParams({ minFree: '0' }).minFreeBeds).toBeUndefined();
    expect(parseBedFilterParams({ minFree: '-2' }).minFreeBeds).toBeUndefined();
    expect(parseBedFilterParams({ minFree: 'abc' }).minFreeBeds).toBeUndefined();
  });

  it('caps long search queries to 64 chars', () => {
    const long = 'a'.repeat(200);
    expect(parseBedFilterParams({ q: long }).query?.length).toBe(64);
  });
});

describe('hasActiveFilter', () => {
  it('returns false for empty filter', () => {
    expect(hasActiveFilter({})).toBe(false);
  });

  it('returns true when any dimension is set', () => {
    expect(hasActiveFilter({ petFriendly: true })).toBe(true);
    expect(hasActiveFilter({ query: 'foo' })).toBe(true);
    expect(hasActiveFilter({ minFreeBeds: 1 })).toBe(true);
  });
});

describe('validateBedCount', () => {
  it('accepts integer occupancies in [0, capacity]', () => {
    expect(validateBedCount(0, 10)).toEqual({ ok: true, value: 0 });
    expect(validateBedCount(10, 10)).toEqual({ ok: true, value: 10 });
    expect(validateBedCount(7, 10)).toEqual({ ok: true, value: 7 });
  });

  it('rejects negative occupancy', () => {
    const r = validateBedCount(-1, 10);
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.error).toMatch(/whole number/);
  });

  it('rejects fractional occupancy', () => {
    const r = validateBedCount(3.5, 10);
    expect(r.ok).toBe(false);
  });

  it('rejects occupancy above capacity with the capacity in the message', () => {
    const r = validateBedCount(11, 10);
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.error).toContain('10');
  });
});
