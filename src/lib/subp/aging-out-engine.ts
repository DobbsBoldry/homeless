/**
 * SUBP-001 — pure aging-out countdown engine.
 *
 * Two pure functions over a `dateOfBirth + asOf` pair:
 *
 *   - `computeDaysUntilEighteen(dateOfBirth, asOf)` — exact day count, with
 *     a sign convention: positive before the 18th birthday, zero on the
 *     18th birthday, negative after.
 *
 *   - `computeMilestone(daysUntilEighteen)` — buckets the day count into
 *     a milestone enum value, or `null` if no milestone has been crossed.
 *
 * No DB access. No clocks. The Inngest job (or a test) supplies `asOf`.
 *
 * Why explicit `asOf`: the nightly job needs to be replayable; tests need
 * to exercise boundary cases (today, +1d, +90d, leap year DOB) without
 * mocking Date.
 */
import type { FosterAgingOutMilestone } from '@/db/schema/enums';

/**
 * Days until the 18th birthday, computed as floor of the millisecond
 * difference / 86_400_000. Both inputs are interpreted as UTC midnight
 * to avoid DST drift around the boundary.
 *
 * Returns:
 *   > 0  — youth has not yet turned 18
 *   = 0  — today is the 18th birthday
 *   < 0  — youth has already aged out (negative day count past birthday)
 */
export function computeDaysUntilEighteen(
  dateOfBirth: Date | string,
  asOf: Date | string,
): number {
  const dob = toUtcMidnight(dateOfBirth);
  const today = toUtcMidnight(asOf);

  // The 18th birthday — same month + day, year + 18. Year() and Month()
  // wrap correctly across leap-day DOBs (Feb 29 → Mar 1 of non-leap years
  // is the JS Date semantics; we accept that as the "legal birthday for
  // age-of-majority" convention used by Kentucky DCBS, mirroring how
  // most state agencies compute it).
  const eighteenth = new Date(
    Date.UTC(dob.getUTCFullYear() + 18, dob.getUTCMonth(), dob.getUTCDate()),
  );

  const msPerDay = 86_400_000;
  return Math.floor((eighteenth.getTime() - today.getTime()) / msPerDay);
}

function toUtcMidnight(d: Date | string): Date {
  if (d instanceof Date) {
    return new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()));
  }
  // YYYY-MM-DD or any parseable date string. Treat the bare date as UTC
  // midnight; if the string already includes a time/tz, normalize to that
  // calendar day in UTC.
  const parsed = new Date(d);
  if (Number.isNaN(parsed.getTime())) {
    throw new Error(`Invalid date: ${d}`);
  }
  return new Date(
    Date.UTC(parsed.getUTCFullYear(), parsed.getUTCMonth(), parsed.getUTCDate()),
  );
}

/**
 * Bucket `daysUntilEighteen` into a milestone. The milestones are
 * upper-edge inclusive: a youth at exactly d=90 hits `d90`, but a youth
 * at d=91 has not yet crossed any milestone (returns null).
 *
 * Aging-out (`d <= 0`) is its own milestone — fired once per youth on the
 * day the engine first observes them past the 18th birthday.
 */
export function computeMilestone(daysUntilEighteen: number): FosterAgingOutMilestone | null {
  if (daysUntilEighteen <= 0) return 'aged_out';
  if (daysUntilEighteen <= 7) return 'd7';
  if (daysUntilEighteen <= 14) return 'd14';
  if (daysUntilEighteen <= 30) return 'd30';
  if (daysUntilEighteen <= 60) return 'd60';
  if (daysUntilEighteen <= 90) return 'd90';
  return null;
}

/**
 * The full set of milestones a youth at `daysUntilEighteen` should have
 * received alerts for, in chronological order (most-distant first).
 *
 * Rationale: the nightly scan job uses this to back-fill alerts for
 * youth who entered the system inside an existing milestone band — e.g.
 * a youth ingested at d=12 should get a `d14` alert immediately on
 * first scan, not wait until d=7. The (youth, milestone) UNIQUE on the
 * alerts table makes this safe to call repeatedly.
 */
export function milestonesReachedBy(
  daysUntilEighteen: number,
): FosterAgingOutMilestone[] {
  const out: FosterAgingOutMilestone[] = [];
  if (daysUntilEighteen <= 90) out.push('d90');
  if (daysUntilEighteen <= 60) out.push('d60');
  if (daysUntilEighteen <= 30) out.push('d30');
  if (daysUntilEighteen <= 14) out.push('d14');
  if (daysUntilEighteen <= 7) out.push('d7');
  if (daysUntilEighteen <= 0) out.push('aged_out');
  return out;
}

/**
 * UI-tier band classification — pairs with milestonesReachedBy for
 * coloring the caseworker list view. Returns the lowest (most urgent)
 * band the youth currently sits in.
 */
export type MilestoneTier = 'critical' | 'urgent' | 'soon' | 'watch' | 'aged_out' | 'safe';

export function classifyTier(daysUntilEighteen: number): MilestoneTier {
  if (daysUntilEighteen <= 0) return 'aged_out';
  if (daysUntilEighteen <= 14) return 'critical';
  if (daysUntilEighteen <= 30) return 'urgent';
  if (daysUntilEighteen <= 60) return 'soon';
  if (daysUntilEighteen <= 90) return 'watch';
  return 'safe';
}
