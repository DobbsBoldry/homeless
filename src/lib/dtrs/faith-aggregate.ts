/**
 * Faith-aggregate domain logic — DTRS-007.
 *
 * The privacy contract (ADR 0003) is enforced here, not in the
 * database. Two halves:
 *
 *   1. Controlled vocabulary. Metric keys and breakout dimensions are
 *      a fixed set; partners can't introduce new ones via the form.
 *      Keeps the macro demand picture comparable across ministries.
 *
 *   2. Cell-size suppression. Counts below the ministry's `min_cell_size`
 *      are stripped to NULL with `suppressed: true` BEFORE insert. The
 *      raw small-cell value never lands in the DB. Suppression is a
 *      pure function of (rawValue, threshold) — see `applySuppression`.
 */

/** Controlled vocabulary for `faith_aggregate_metrics.metric_key`. */
export const FAITH_METRIC_KEYS = [
  'meals_served',
  'visits_total',
  'first_time_visits',
  'households_served',
  'households_with_children',
  'beds_provided',
  'utility_assistance_count',
  'rent_assistance_count',
  'food_pantry_visits',
  'counseling_visits',
] as const;

export type FaithMetricKey = (typeof FAITH_METRIC_KEYS)[number];

/**
 * Controlled vocabulary for `faith_aggregate_breakouts`. Each dimension
 * has a fixed bucket set; partners pick from these on the intake form.
 * Adding a new bucket is a deliberate change (touches the form, the
 * lookup, and the audit story).
 */
export const FAITH_BREAKOUT_DIMENSIONS = {
  age_band: ['under_18', '18_24', '25_44', '45_64', '65_plus', 'unknown'],
  family_status: ['single_adult', 'family_with_children', 'unaccompanied_youth', 'unknown'],
  gender: ['male', 'female', 'nonbinary', 'declined', 'unknown'],
  veteran_status: ['veteran', 'non_veteran', 'unknown'],
} as const satisfies Record<string, readonly string[]>;

export type FaithBreakoutDimension = keyof typeof FAITH_BREAKOUT_DIMENSIONS;

/** Cell after suppression has been applied. */
export type SuppressedCell =
  | { value: number; suppressed: false }
  | { value: null; suppressed: true };

/**
 * The privacy primitive. If `raw` is below `threshold` (or negative,
 * which would be a bug), strip it to a suppressed NULL. Otherwise pass
 * through as a non-suppressed value.
 *
 * Threshold semantics: a count of *exactly* `threshold` is fine — the
 * cell represents at-least-`threshold` people. We suppress when raw <
 * threshold, matching the OMU "N>10 minimum cell-size" framing
 * (interpreted as "10 or more is reportable"; 9 or fewer is suppressed).
 */
export function applySuppression(raw: number, threshold: number): SuppressedCell {
  if (!Number.isInteger(raw) || raw < 0) {
    throw new Error(`raw count must be a non-negative integer, got ${raw}`);
  }
  if (!Number.isInteger(threshold) || threshold < 1) {
    throw new Error(`threshold must be a positive integer, got ${threshold}`);
  }
  if (raw < threshold) return { value: null, suppressed: true };
  return { value: raw, suppressed: false };
}

export type RawMetricInput = { metricKey: string; value: number };
export type RawBreakoutInput = { dimension: string; bucket: string; count: number };

export type ValidatedMetric = {
  metricKey: FaithMetricKey;
  value: number | null;
  suppressed: boolean;
};

export type ValidatedBreakout = {
  dimension: FaithBreakoutDimension;
  bucket: string;
  count: number | null;
  suppressed: boolean;
};

/**
 * Validate + suppress a batch of metrics. Throws on unknown metric_key
 * or non-integer / negative input. Returns DB-ready rows. Never stores
 * the raw small-cell value.
 */
export function processMetrics(
  raws: readonly RawMetricInput[],
  minCellSize: number,
): ValidatedMetric[] {
  return raws.map((r) => {
    if (!FAITH_METRIC_KEYS.includes(r.metricKey as FaithMetricKey)) {
      throw new Error(
        `unknown metric_key: ${r.metricKey} (allowed: ${FAITH_METRIC_KEYS.join(', ')})`,
      );
    }
    const cell = applySuppression(r.value, minCellSize);
    return {
      metricKey: r.metricKey as FaithMetricKey,
      value: cell.value,
      suppressed: cell.suppressed,
    };
  });
}

/** Same shape as processMetrics, for demographic breakouts. */
export function processBreakouts(
  raws: readonly RawBreakoutInput[],
  minCellSize: number,
): ValidatedBreakout[] {
  return raws.map((r) => {
    if (!(r.dimension in FAITH_BREAKOUT_DIMENSIONS)) {
      throw new Error(
        `unknown dimension: ${r.dimension} (allowed: ${Object.keys(FAITH_BREAKOUT_DIMENSIONS).join(', ')})`,
      );
    }
    const dim = r.dimension as FaithBreakoutDimension;
    const allowed: readonly string[] = FAITH_BREAKOUT_DIMENSIONS[dim];
    if (!allowed.includes(r.bucket)) {
      throw new Error(
        `unknown bucket "${r.bucket}" for dimension "${dim}" (allowed: ${allowed.join(', ')})`,
      );
    }
    const cell = applySuppression(r.count, minCellSize);
    return { dimension: dim, bucket: r.bucket, count: cell.value, suppressed: cell.suppressed };
  });
}

/**
 * Validate the submission's period coherence. Period bounds must form
 * a sensible date range; the period_kind labels which kind of bucket
 * (week/month/quarter) — we don't enforce alignment with calendar
 * boundaries (a parish week may run Tue-Mon).
 */
export function validatePeriod(periodStart: Date, periodEnd: Date): void {
  if (Number.isNaN(periodStart.getTime()) || Number.isNaN(periodEnd.getTime())) {
    throw new Error('period_start and period_end must be valid dates');
  }
  if (periodStart > periodEnd) {
    throw new Error(
      `period_start (${periodStart.toISOString()}) must be <= period_end (${periodEnd.toISOString()})`,
    );
  }
}
