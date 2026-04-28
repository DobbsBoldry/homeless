/**
 * PRVN-004 — unit tests for school-referral-insights pure helpers.
 *
 * No DB connection required. All three helpers are pure functions.
 */
import { describe, expect, it } from 'vitest';
import {
  ALL_SCHOOL_REFERRAL_STATUSES,
  aggregateServiceBreakdown,
  aggregateStatusDistribution,
  computeMedianDays,
} from './school-referral-insights';

// ---------------------------------------------------------------------------
// aggregateStatusDistribution
// ---------------------------------------------------------------------------

describe('aggregateStatusDistribution', () => {
  it('returns one entry per status even when count is 0', () => {
    const result = aggregateStatusDistribution([]);
    expect(result).toHaveLength(ALL_SCHOOL_REFERRAL_STATUSES.length);
    expect(result.every((r) => r.count === 0)).toBe(true);
  });

  it('counts statuses correctly on a happy-path set', () => {
    const rows = [
      { status: 'received' },
      { status: 'received' },
      { status: 'connected' },
      { status: 'triaged' },
      { status: 'closed_completed' },
    ];
    const result = aggregateStatusDistribution(rows);
    const get = (s: string) => result.find((r) => r.status === s)?.count ?? -1;

    expect(get('received')).toBe(2);
    expect(get('connected')).toBe(1);
    expect(get('triaged')).toBe(1);
    expect(get('closed_completed')).toBe(1);
    expect(get('in_progress')).toBe(0);
    expect(get('closed_unreachable')).toBe(0);
  });

  it('always returns all six statuses regardless of input', () => {
    const rows = [{ status: 'connected' }];
    const result = aggregateStatusDistribution(rows);
    const statuses = result.map((r) => r.status);
    for (const s of ALL_SCHOOL_REFERRAL_STATUSES) {
      expect(statuses).toContain(s);
    }
  });

  it('handles a single-status input', () => {
    const rows = [{ status: 'in_progress' }, { status: 'in_progress' }];
    const result = aggregateStatusDistribution(rows);
    expect(result.find((r) => r.status === 'in_progress')?.count).toBe(2);
    expect(result.filter((r) => r.status !== 'in_progress').every((r) => r.count === 0)).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// computeMedianDays
// ---------------------------------------------------------------------------

describe('computeMedianDays', () => {
  it('returns null for an empty array', () => {
    expect(computeMedianDays([])).toBeNull();
  });

  it('returns the single value for a length-1 array', () => {
    expect(computeMedianDays([7])).toBe(7);
  });

  it('returns the middle value for odd-length sorted input', () => {
    expect(computeMedianDays([1, 3, 5])).toBe(3);
  });

  it('returns the middle value for odd-length unsorted input', () => {
    expect(computeMedianDays([5, 1, 3])).toBe(3);
  });

  it('returns the average of the two middle values for even-length input', () => {
    expect(computeMedianDays([2, 4, 6, 8])).toBe(5); // (4+6)/2
  });

  it('handles even-length with a fractional median', () => {
    expect(computeMedianDays([1, 2])).toBe(1.5);
  });

  it('handles ties (all same value)', () => {
    expect(computeMedianDays([3, 3, 3])).toBe(3);
  });

  it('handles a realistic time-to-connect set', () => {
    // 5 referrals took: 1 day, 3 days, 7 days, 14 days, 21 days
    expect(computeMedianDays([14, 1, 7, 3, 21])).toBe(7);
  });
});

// ---------------------------------------------------------------------------
// aggregateServiceBreakdown
// ---------------------------------------------------------------------------

describe('aggregateServiceBreakdown', () => {
  it('returns empty array for empty input', () => {
    expect(aggregateServiceBreakdown([])).toEqual([]);
  });

  it('returns empty array when no referral has any services', () => {
    const rows = [{ servicesRequested: [] }, { servicesRequested: [] }];
    expect(aggregateServiceBreakdown(rows)).toEqual([]);
  });

  it('counts each service once per referral row', () => {
    const rows = [
      { servicesRequested: ['shelter_placement', 'case_management'] },
      { servicesRequested: ['shelter_placement', 'food_assistance'] },
      { servicesRequested: ['food_assistance'] },
    ];
    const result = aggregateServiceBreakdown(rows);
    const get = (svc: string) => result.find((r) => r.service === svc)?.count ?? 0;

    expect(get('shelter_placement')).toBe(2);
    expect(get('case_management')).toBe(1);
    expect(get('food_assistance')).toBe(2);
  });

  it('skips services with count 0 (not included at all)', () => {
    const rows = [{ servicesRequested: ['shelter_placement'] }];
    const result = aggregateServiceBreakdown(rows);
    expect(result.every((r) => r.count > 0)).toBe(true);
    expect(result.find((r) => r.service === 'transportation')).toBeUndefined();
  });

  it('handles a single referral with multiple services', () => {
    const rows = [{ servicesRequested: ['mental_health', 'utility_assistance', 'transportation'] }];
    const result = aggregateServiceBreakdown(rows);
    expect(result).toHaveLength(3);
    expect(result.every((r) => r.count === 1)).toBe(true);
  });

  it('returns results in controlled-vocabulary order', () => {
    // Insert services in reverse vocabulary order — output should be canonical order.
    const rows = [{ servicesRequested: ['mental_health', 'shelter_placement'] }];
    const result = aggregateServiceBreakdown(rows);
    const services = result.map((r) => r.service);
    // shelter_placement appears before mental_health in SCHOOL_REFERRAL_SERVICES
    expect(services.indexOf('shelter_placement')).toBeLessThan(services.indexOf('mental_health'));
  });
});
