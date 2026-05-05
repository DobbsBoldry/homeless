import { describe, expect, it } from 'vitest';
import {
  classifyReleaseTier,
  computeDaysUntilRelease,
  isInPreReleaseWindow,
  POST_RELEASE_TAIL_DAYS_DEFAULT,
  shouldDeleteForWindowExpiry,
} from './pre-release-engine';

describe('computeDaysUntilRelease', () => {
  it('returns positive count when release is in the future', () => {
    expect(computeDaysUntilRelease('2026-09-01', '2026-08-01')).toBe(31);
    expect(computeDaysUntilRelease('2026-08-15', '2026-08-01')).toBe(14);
  });

  it('returns 0 on release day', () => {
    expect(computeDaysUntilRelease('2026-08-01', '2026-08-01')).toBe(0);
  });

  it('returns negative count after release', () => {
    expect(computeDaysUntilRelease('2026-08-01', '2026-08-08')).toBe(-7);
    expect(computeDaysUntilRelease('2026-08-01', '2026-08-31')).toBe(-30);
  });

  it('handles Date objects on either side', () => {
    const release = new Date('2026-08-15T00:00:00Z');
    const today = new Date('2026-08-01T00:00:00Z');
    expect(computeDaysUntilRelease(release, today)).toBe(14);
  });

  it('normalizes to UTC midnight (no DST drift around the boundary)', () => {
    // Same calendar day, different times.
    expect(computeDaysUntilRelease('2026-08-15', '2026-08-15T23:00:00Z')).toBe(0);
    expect(computeDaysUntilRelease('2026-08-16', '2026-08-15T23:00:00Z')).toBe(1);
  });

  it('throws on invalid date string', () => {
    expect(() => computeDaysUntilRelease('not-a-date', '2026-08-01')).toThrow('Invalid date');
  });
});

describe('isInPreReleaseWindow', () => {
  it('accepts the lower bound (0 days = release day)', () => {
    expect(isInPreReleaseWindow(0, 60)).toBe(true);
  });

  it('accepts the upper bound (window day)', () => {
    expect(isInPreReleaseWindow(60, 60)).toBe(true);
  });

  it('accepts mid-window', () => {
    expect(isInPreReleaseWindow(30, 60)).toBe(true);
  });

  it('rejects past release (negative days)', () => {
    expect(isInPreReleaseWindow(-1, 60)).toBe(false);
    expect(isInPreReleaseWindow(-30, 60)).toBe(false);
  });

  it('rejects beyond window', () => {
    expect(isInPreReleaseWindow(61, 60)).toBe(false);
    expect(isInPreReleaseWindow(180, 60)).toBe(false);
  });

  it('honors a custom window length', () => {
    expect(isInPreReleaseWindow(120, 180)).toBe(true);
    expect(isInPreReleaseWindow(45, 30)).toBe(false);
  });
});

describe('shouldDeleteForWindowExpiry', () => {
  it('keeps un-handed-off subjects in the post-release tail', () => {
    // Post-release tail is 7 days; -7 should still be kept (off-by-one safety).
    expect(shouldDeleteForWindowExpiry(-7, null)).toBe(false);
    expect(shouldDeleteForWindowExpiry(-3, null)).toBe(false);
    expect(shouldDeleteForWindowExpiry(0, null)).toBe(false);
    expect(shouldDeleteForWindowExpiry(30, null)).toBe(false);
  });

  it('deletes un-handed-off subjects past the tail', () => {
    expect(shouldDeleteForWindowExpiry(-8, null)).toBe(true);
    expect(shouldDeleteForWindowExpiry(-30, null)).toBe(true);
  });

  it('never deletes handed-off subjects, even past the tail', () => {
    const handedOff = new Date('2026-09-01T12:00:00Z');
    expect(shouldDeleteForWindowExpiry(-8, handedOff)).toBe(false);
    expect(shouldDeleteForWindowExpiry(-100, handedOff)).toBe(false);
  });

  it('honors a custom post-release tail', () => {
    expect(shouldDeleteForWindowExpiry(-3, null, 5)).toBe(false);
    expect(shouldDeleteForWindowExpiry(-6, null, 5)).toBe(true);
  });

  it('uses the documented default tail (7 days)', () => {
    expect(POST_RELEASE_TAIL_DAYS_DEFAULT).toBe(7);
  });
});

describe('classifyReleaseTier', () => {
  it('classifies released (any negative)', () => {
    expect(classifyReleaseTier(-1)).toBe('released');
    expect(classifyReleaseTier(-100)).toBe('released');
  });

  it('classifies critical (0-7)', () => {
    expect(classifyReleaseTier(0)).toBe('critical');
    expect(classifyReleaseTier(7)).toBe('critical');
  });

  it('classifies urgent (8-14)', () => {
    expect(classifyReleaseTier(8)).toBe('urgent');
    expect(classifyReleaseTier(14)).toBe('urgent');
  });

  it('classifies soon (15-30)', () => {
    expect(classifyReleaseTier(15)).toBe('soon');
    expect(classifyReleaseTier(30)).toBe('soon');
  });

  it('classifies planning (31-60)', () => {
    expect(classifyReleaseTier(31)).toBe('planning');
    expect(classifyReleaseTier(60)).toBe('planning');
  });

  it('classifies watch (>60)', () => {
    expect(classifyReleaseTier(61)).toBe('watch');
    expect(classifyReleaseTier(180)).toBe('watch');
  });
});
