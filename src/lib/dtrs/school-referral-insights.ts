/**
 * PRVN-004 — pure aggregator helpers for school-referral liaison insights.
 *
 * No DB imports here. These functions take raw row arrays and compute
 * aggregate values, making them testable in isolation (no DB connection needed).
 *
 * Consumed by getLiaisonInsights in src/db/queries/school-referrals.ts.
 */

import { SCHOOL_REFERRAL_SERVICES, type SchoolReferralService } from './school-referral-vocabulary';

// Re-export the type so callers can import from this file without a separate
// vocabulary import — convenience only, no extra bundle cost.
export type { SchoolReferralService };

// ---------------------------------------------------------------------------
// SchoolReferralStatus mirror
// ---------------------------------------------------------------------------

// All six statuses in declaration order (matches school_referral_status enum).
export const ALL_SCHOOL_REFERRAL_STATUSES = [
  'received',
  'triaged',
  'in_progress',
  'connected',
  'closed_unreachable',
  'closed_completed',
] as const;

export type SchoolReferralStatusLocal = (typeof ALL_SCHOOL_REFERRAL_STATUSES)[number];

// ---------------------------------------------------------------------------
// aggregateStatusDistribution
// ---------------------------------------------------------------------------

/**
 * Counts referrals per status. Returns one entry per status value in the
 * controlled vocabulary, even if the count is 0 — fixed shape is easier to
 * render and avoids conditional rendering of table rows on the page.
 */
export function aggregateStatusDistribution(
  rows: { status: string }[],
): { status: SchoolReferralStatusLocal; count: number }[] {
  const counts = new Map<string, number>();
  for (const r of rows) {
    counts.set(r.status, (counts.get(r.status) ?? 0) + 1);
  }
  return ALL_SCHOOL_REFERRAL_STATUSES.map((status) => ({
    status,
    count: counts.get(status) ?? 0,
  }));
}

// ---------------------------------------------------------------------------
// aggregateServiceBreakdown
// ---------------------------------------------------------------------------

/**
 * Counts how many referral rows include each service. `servicesRequested` is
 * a string array on each row (the JSONB column deserialized). Only services
 * that appear at least once are returned.
 */
export function aggregateServiceBreakdown(
  rows: { servicesRequested: string[] }[],
): { service: SchoolReferralService; count: number }[] {
  const counts = new Map<string, number>();
  for (const r of rows) {
    for (const svc of r.servicesRequested) {
      counts.set(svc, (counts.get(svc) ?? 0) + 1);
    }
  }
  // Return only the controlled-vocabulary services that appear at least once,
  // in controlled-vocabulary order (for stable rendering).
  return SCHOOL_REFERRAL_SERVICES.filter((svc) => counts.has(svc)).map((svc) => ({
    service: svc,
    count: counts.get(svc) ?? 0,
  }));
}

// ---------------------------------------------------------------------------
// computeMedianDays
// ---------------------------------------------------------------------------

/**
 * Median of an array of day-deltas. Returns null when the array is empty.
 *
 * Uses the standard percentile_cont(0.5) definition:
 *   - Odd length: middle value.
 *   - Even length: average of the two middle values.
 * Values need not be sorted before passing.
 */
export function computeMedianDays(timeDeltasInDays: number[]): number | null {
  if (timeDeltasInDays.length === 0) return null;
  const sorted = [...timeDeltasInDays].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  if (sorted.length % 2 === 1) {
    return sorted[mid] ?? null;
  }
  const lo = sorted[mid - 1];
  const hi = sorted[mid];
  if (lo === undefined || hi === undefined) return null;
  return (lo + hi) / 2;
}
