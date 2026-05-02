/**
 * SUBP-005 — pure pre-release countdown / window engine.
 *
 * Three pure functions:
 *
 *   - `computeDaysUntilRelease(projectedReleaseDate, asOf)` — exact day
 *     count, with a sign convention: positive before release, zero on
 *     release day, negative after.
 *
 *   - `isInPreReleaseWindow(daysUntilRelease, windowDays)` — true when
 *     the subject's projected release falls within `[0, windowDays]`
 *     (inclusive both ends). Used at ingest time to decide whether a
 *     given KY DOC record is in scope.
 *
 *   - `shouldDeleteForWindowExpiry(daysUntilRelease, postReleaseTailDays, handedOffAt)` —
 *     true when the subject has aged past the post-release tail without
 *     a successful warm handoff. Per ADR 0009 § 5.1, delete within 7
 *     days of release for un-handed-off subjects; subjects with a handoff
 *     are kept under the agreement's data destruction policy and are
 *     never returned true here.
 *
 *   - `classifyTier(daysUntilRelease)` — bucket the day count into a
 *     UI urgency band. Mirrors the foster aging-out tier shape but
 *     re-targeted for reentry timelines.
 *
 * No DB access. No clocks. The Inngest job (or a test) supplies `asOf`.
 *
 * Why explicit `asOf`: the daily sweep needs to be replayable; tests need
 * to exercise boundary cases (today, +1d, -7d, -8d) without mocking Date.
 */

/**
 * Days until projected release. Negative after release.
 *
 * Returns:
 *   > 0  — release is in the future
 *   = 0  — today is release day
 *   < 0  — release was in the past (count of days since)
 */
export function computeDaysUntilRelease(
  projectedReleaseDate: Date | string,
  asOf: Date | string,
): number {
  const release = toUtcMidnight(projectedReleaseDate);
  const today = toUtcMidnight(asOf);
  const msPerDay = 86_400_000;
  return Math.floor((release.getTime() - today.getTime()) / msPerDay);
}

function toUtcMidnight(d: Date | string): Date {
  if (d instanceof Date) {
    return new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()));
  }
  const parsed = new Date(d);
  if (Number.isNaN(parsed.getTime())) {
    throw new Error(`Invalid date: ${d}`);
  }
  return new Date(Date.UTC(parsed.getUTCFullYear(), parsed.getUTCMonth(), parsed.getUTCDate()));
}

/**
 * True when the subject's projected release falls within the agreement's
 * pre-release window — i.e. `0 <= daysUntilRelease <= windowDays`.
 *
 * Used at ingest time. The KY DOC feed may push records up to the window
 * length out; subjects past their projected release are out-of-window
 * (a small grace tail is handled separately by the sweep, not here).
 */
export function isInPreReleaseWindow(daysUntilRelease: number, windowDays: number): boolean {
  return daysUntilRelease >= 0 && daysUntilRelease <= windowDays;
}

/**
 * Default post-release tail, in days. ADR 0009 § 5.1 calls for deletion
 * within 7 days of release for un-handed-off subjects. The sweep uses
 * this as the window past which deletion is required.
 */
export const POST_RELEASE_TAIL_DAYS_DEFAULT = 7;

/**
 * Decide whether a subject should be deleted by the daily sweep. True
 * iff the subject is past the post-release tail AND has not been handed
 * off. Subjects with a non-null `handedOffAt` are kept under the standard
 * data destruction policy and are never returned true.
 *
 * The "post-release tail" is the grace period after release during which
 * a late handoff confirmation is still possible. After it, the sweep
 * deletes per ADR 0009 § 5.1.
 */
export function shouldDeleteForWindowExpiry(
  daysUntilRelease: number,
  handedOffAt: Date | string | null,
  postReleaseTailDays: number = POST_RELEASE_TAIL_DAYS_DEFAULT,
): boolean {
  if (handedOffAt) return false;
  // daysUntilRelease < -postReleaseTailDays means the subject is past the
  // tail. Strict inequality so a subject at exactly -tail is kept one
  // more sweep cycle (defense against off-by-one timezone drift).
  return daysUntilRelease < -postReleaseTailDays;
}

/**
 * UI urgency tier for the caseworker list view. Mirrors the foster
 * aging-out shape:
 *   - released: post-release (could be in tail or handed off)
 *   - critical (≤7 days): release imminent
 *   - urgent   (≤14 days): final-week coordination push
 *   - soon     (≤30 days): one month out — supports must be locked
 *   - planning (≤60 days): two months out — active planning
 *   - watch    (>60 days): tracking only
 */
export type PreReleaseTier = 'released' | 'critical' | 'urgent' | 'soon' | 'planning' | 'watch';

/**
 * Renamed from `classifyTier` to avoid the naming collision with
 * `aging-out-engine.classifyTier` once both modules export through the
 * `subp` barrel. The two tiers have different return-type unions.
 */
export function classifyReleaseTier(daysUntilRelease: number): PreReleaseTier {
  if (daysUntilRelease < 0) return 'released';
  if (daysUntilRelease <= 7) return 'critical';
  if (daysUntilRelease <= 14) return 'urgent';
  if (daysUntilRelease <= 30) return 'soon';
  if (daysUntilRelease <= 60) return 'planning';
  return 'watch';
}
