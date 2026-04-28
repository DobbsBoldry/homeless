import { describe, expect, it } from 'vitest';
import {
  classifyTier,
  computeDaysUntilEighteen,
  computeMilestone,
  milestonesReachedBy,
} from './aging-out-engine';

// ---------------------------------------------------------------------------
// computeDaysUntilEighteen
// ---------------------------------------------------------------------------

describe('computeDaysUntilEighteen', () => {
  it('returns 0 on the 18th birthday', () => {
    const dob = '2008-04-28';
    const asOf = '2026-04-28';
    expect(computeDaysUntilEighteen(dob, asOf)).toBe(0);
  });

  it('returns 1 on the day before the 18th birthday', () => {
    const dob = '2008-04-28';
    const asOf = '2026-04-27';
    expect(computeDaysUntilEighteen(dob, asOf)).toBe(1);
  });

  it('returns -1 the day after aging out', () => {
    const dob = '2008-04-28';
    const asOf = '2026-04-29';
    expect(computeDaysUntilEighteen(dob, asOf)).toBe(-1);
  });

  it('returns 90 exactly 90 days before the 18th birthday', () => {
    const dob = '2008-04-28';
    const asOf = '2026-01-28'; // 28 + 31 (Feb) + 31 (Mar) = 90 → Jan 28 to Apr 28
    expect(computeDaysUntilEighteen(dob, asOf)).toBe(90);
  });

  it('handles leap-day DOB (Feb 29 → Mar 1 in non-leap year, Kentucky convention)', () => {
    const dob = '2008-02-29';
    // 18 years later: 2026 is not a leap year. JS Date wraps Feb 29 → Mar 1.
    const onMar1 = '2026-03-01';
    expect(computeDaysUntilEighteen(dob, onMar1)).toBe(0);
  });

  it('accepts Date objects as input', () => {
    const dob = new Date(Date.UTC(2008, 3, 28)); // 2008-04-28 UTC
    const asOf = new Date(Date.UTC(2026, 3, 21)); // 2026-04-21 UTC
    expect(computeDaysUntilEighteen(dob, asOf)).toBe(7);
  });

  it('throws on invalid date string', () => {
    expect(() => computeDaysUntilEighteen('not-a-date', '2026-04-28')).toThrow('Invalid date');
  });
});

// ---------------------------------------------------------------------------
// computeMilestone
// ---------------------------------------------------------------------------

describe('computeMilestone', () => {
  it('returns null for >90 days out', () => {
    expect(computeMilestone(91)).toBeNull();
    expect(computeMilestone(365)).toBeNull();
  });

  it('returns d90 at exactly 90 days', () => {
    expect(computeMilestone(90)).toBe('d90');
    expect(computeMilestone(89)).toBe('d90');
    expect(computeMilestone(61)).toBe('d90');
  });

  it('returns d60 at exactly 60 days', () => {
    expect(computeMilestone(60)).toBe('d60');
    expect(computeMilestone(31)).toBe('d60');
  });

  it('returns d30, d14, d7 at their bands', () => {
    expect(computeMilestone(30)).toBe('d30');
    expect(computeMilestone(15)).toBe('d30');
    expect(computeMilestone(14)).toBe('d14');
    expect(computeMilestone(8)).toBe('d14');
    expect(computeMilestone(7)).toBe('d7');
    expect(computeMilestone(1)).toBe('d7');
  });

  it('returns aged_out on or after the 18th birthday', () => {
    expect(computeMilestone(0)).toBe('aged_out');
    expect(computeMilestone(-1)).toBe('aged_out');
    expect(computeMilestone(-365)).toBe('aged_out');
  });
});

// ---------------------------------------------------------------------------
// milestonesReachedBy
// ---------------------------------------------------------------------------

describe('milestonesReachedBy', () => {
  it('returns empty array for >90d', () => {
    expect(milestonesReachedBy(91)).toEqual([]);
  });

  it('returns just d90 at the 90-day boundary', () => {
    expect(milestonesReachedBy(90)).toEqual(['d90']);
  });

  it('back-fills milestones for a youth ingested mid-band', () => {
    // Youth ingested at d=12 should get d90, d60, d30, d14 alerts
    // immediately on first scan — they crossed those bands before
    // entering the system.
    expect(milestonesReachedBy(12)).toEqual(['d90', 'd60', 'd30', 'd14']);
  });

  it('returns full ladder for an aged-out youth', () => {
    expect(milestonesReachedBy(-1)).toEqual(['d90', 'd60', 'd30', 'd14', 'd7', 'aged_out']);
  });

  it('returns d90, d60, d30, d14, d7 at exactly d=7', () => {
    expect(milestonesReachedBy(7)).toEqual(['d90', 'd60', 'd30', 'd14', 'd7']);
  });
});

// ---------------------------------------------------------------------------
// classifyTier
// ---------------------------------------------------------------------------

describe('classifyTier', () => {
  it('classifies safe (>90d), watch (61-90d), soon (31-60d), urgent (15-30d), critical (1-14d)', () => {
    expect(classifyTier(91)).toBe('safe');
    expect(classifyTier(90)).toBe('watch');
    expect(classifyTier(61)).toBe('watch');
    expect(classifyTier(60)).toBe('soon');
    expect(classifyTier(31)).toBe('soon');
    expect(classifyTier(30)).toBe('urgent');
    expect(classifyTier(15)).toBe('urgent');
    expect(classifyTier(14)).toBe('critical');
    expect(classifyTier(1)).toBe('critical');
  });

  it('classifies aged_out at d<=0', () => {
    expect(classifyTier(0)).toBe('aged_out');
    expect(classifyTier(-1)).toBe('aged_out');
  });
});
