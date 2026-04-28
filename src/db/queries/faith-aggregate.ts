import { and, asc, desc, count as drizzleCount, eq, gte, inArray, lte } from 'drizzle-orm';
import type { PgColumn } from 'drizzle-orm/pg-core';
import { db } from '@/db/client';
import {
  type FaithAggregateSubmission,
  type FaithMinistry,
  faithAggregateBreakouts,
  faithAggregateMetrics,
  faithAggregateSubmissions,
  faithMinistries,
} from '@/db/schema';
import type { FaithAggregatePeriodKind } from '@/db/schema/enums';
import { logAuditEvent } from '@/lib/audit';
import {
  type FaithMetricKey,
  processBreakouts,
  processMetrics,
  type RawBreakoutInput,
  type RawMetricInput,
  validatePeriod,
} from '@/lib/dtrs';

export type FaithAggregatePeriodKindLocal = FaithAggregatePeriodKind;

export interface CreateSubmissionInput {
  ministryId: string;
  periodKind: FaithAggregatePeriodKind;
  periodStart: Date;
  periodEnd: Date;
  submittedByUserId: string | null;
  notes?: string | null;
  metrics: readonly RawMetricInput[];
  breakouts: readonly RawBreakoutInput[];
}

export type SubmissionWithCounts = FaithAggregateSubmission & {
  ministryName: string;
  metricCount: number;
  breakoutCount: number;
};

/**
 * List opted-in ministries (status = 'opted_in'), most recently opted-in
 * first. Includes paused/opted-out only when `status` is passed.
 */
export async function listFaithMinistries(
  opts: { status?: 'opted_in' | 'paused' | 'opted_out' | 'any' } = {},
): Promise<FaithMinistry[]> {
  const status = opts.status ?? 'opted_in';
  const where = status === 'any' ? undefined : eq(faithMinistries.status, status);
  const q = db.select().from(faithMinistries).orderBy(desc(faithMinistries.optedInAt));
  return where ? q.where(where) : q;
}

export async function getFaithMinistry(id: string): Promise<FaithMinistry | null> {
  const rows = await db.select().from(faithMinistries).where(eq(faithMinistries.id, id)).limit(1);
  return rows[0] ?? null;
}

/**
 * Insert a submission + its metrics + its breakouts in one transaction.
 * Suppression is applied BEFORE the rows are constructed; raw small-cell
 * counts never reach the DB. See ADR 0003 for the privacy contract.
 *
 * Audit-log entry written inside the transaction so a write failure
 * rolls back both the data and the log entry — keeps "what landed in
 * the trust" and "what we said landed in the trust" consistent.
 */
export async function createFaithAggregateSubmission(
  input: CreateSubmissionInput,
): Promise<FaithAggregateSubmission> {
  validatePeriod(input.periodStart, input.periodEnd);

  const ministry = await getFaithMinistry(input.ministryId);
  if (!ministry) throw new Error(`ministry not found: ${input.ministryId}`);
  if (ministry.status !== 'opted_in') {
    throw new Error(
      `ministry ${ministry.name} is ${ministry.status}; cannot accept new submissions`,
    );
  }

  // Apply suppression up-front. processMetrics/processBreakouts also
  // validate the controlled vocabulary — if any key/dimension is bad,
  // we throw before opening the transaction.
  const metricRows = processMetrics(input.metrics, ministry.minCellSize);
  const breakoutRows = processBreakouts(input.breakouts, ministry.minCellSize);

  return db.transaction(async (tx) => {
    const [submission] = await tx
      .insert(faithAggregateSubmissions)
      .values({
        ministryId: input.ministryId,
        periodKind: input.periodKind,
        periodStart: input.periodStart.toISOString().slice(0, 10),
        periodEnd: input.periodEnd.toISOString().slice(0, 10),
        submittedByUserId: input.submittedByUserId,
        notes: input.notes ?? null,
      })
      .returning();
    if (!submission) throw new Error('faith_aggregate_submissions insert returned no row');

    if (metricRows.length > 0) {
      await tx.insert(faithAggregateMetrics).values(
        metricRows.map((m) => ({
          submissionId: submission.id,
          metricKey: m.metricKey,
          value: m.value,
          suppressed: m.suppressed,
        })),
      );
    }
    if (breakoutRows.length > 0) {
      await tx.insert(faithAggregateBreakouts).values(
        breakoutRows.map((b) => ({
          submissionId: submission.id,
          dimension: b.dimension,
          bucket: b.bucket,
          count: b.count,
          suppressed: b.suppressed,
        })),
      );
    }

    await logAuditEvent({
      actorUserId: input.submittedByUserId,
      action: 'faith_aggregate.submitted',
      targetTable: 'faith_aggregate_submissions',
      targetId: submission.id,
      metadata: {
        ministryId: input.ministryId,
        ministryName: ministry.name,
        periodKind: input.periodKind,
        periodStart: input.periodStart.toISOString().slice(0, 10),
        periodEnd: input.periodEnd.toISOString().slice(0, 10),
        metricCount: metricRows.length,
        suppressedMetricCount: metricRows.filter((m) => m.suppressed).length,
        breakoutCount: breakoutRows.length,
        suppressedBreakoutCount: breakoutRows.filter((b) => b.suppressed).length,
      },
    });

    return submission;
  });
}

/** All submissions for a ministry, most recent first. */
export async function listSubmissionsForMinistry(
  ministryId: string,
  opts: { limit?: number } = {},
): Promise<FaithAggregateSubmission[]> {
  const { limit = 50 } = opts;
  return db
    .select()
    .from(faithAggregateSubmissions)
    .where(eq(faithAggregateSubmissions.ministryId, ministryId))
    .orderBy(desc(faithAggregateSubmissions.periodStart))
    .limit(limit);
}

/** Single submission + child counts, for the admin detail view. */
export async function getSubmissionWithCounts(
  submissionId: string,
): Promise<SubmissionWithCounts | null> {
  const row = await db
    .select({
      submission: faithAggregateSubmissions,
      ministryName: faithMinistries.name,
    })
    .from(faithAggregateSubmissions)
    .innerJoin(faithMinistries, eq(faithMinistries.id, faithAggregateSubmissions.ministryId))
    .where(eq(faithAggregateSubmissions.id, submissionId))
    .limit(1);
  if (!row[0]) return null;

  const [{ count: metricCount }] = await db
    .select({ count: countExpr(faithAggregateMetrics.id) })
    .from(faithAggregateMetrics)
    .where(eq(faithAggregateMetrics.submissionId, submissionId));
  const [{ count: breakoutCount }] = await db
    .select({ count: countExpr(faithAggregateBreakouts.id) })
    .from(faithAggregateBreakouts)
    .where(eq(faithAggregateBreakouts.submissionId, submissionId));

  return {
    ...row[0].submission,
    ministryName: row[0].ministryName,
    metricCount: Number(metricCount),
    breakoutCount: Number(breakoutCount),
  };
}

function countExpr(col: PgColumn) {
  return drizzleCount(col).as('count');
}

// ---------------------------------------------------------------------------
// DTRS-009 read queries — coalition-level coordination signals (admin only)
// ---------------------------------------------------------------------------

/**
 * Converts a Date to a YYYY-MM-DD string for comparison against Drizzle
 * `date()` columns. The typed builder (gte/lte) coerces ISO strings
 * correctly for Postgres date columns. See STATE.md quirk: raw sql
 * templates need .toISOString(); the typed builder does not.
 */
function toDateStr(d: Date): string {
  return d.toISOString().slice(0, 10);
}

// --- Types ------------------------------------------------------------------

export type SubmissionSummary = FaithAggregateSubmission & {
  ministryName: string;
  suppressedMetricCount: number;
};

export type MinistryTrendPoint = {
  periodStart: string; // YYYY-MM-DD
  periodEnd: string;
  value: number | null;
  suppressed: boolean;
};

export type CoalitionMetricTotal = {
  metricKey: FaithMetricKey;
  totalValue: number;
  reportingMinistries: number;
  suppressedMinistries: number;
};

export type CoalitionBreakoutTotal = {
  dimension: string;
  bucket: string;
  totalValue: number;
  reportingMinistries: number;
  suppressedMinistries: number;
};

export type WindowComparison = {
  metricKey: FaithMetricKey;
  current: number | null;
  /** True when at least one cell for this metric in the current window was suppressed. */
  currentPartial: boolean;
  prior: number | null;
  /** True when at least one cell for this metric in the prior window was suppressed. */
  priorPartial: boolean;
  /**
   * Percentage-point delta — e.g. `12.5` means +12.5%, not +0.125.
   * Null when either window value is null (all-suppressed).
   */
  deltaPct: number | null;
};

export type MinistryInsightRow = {
  id: string;
  name: string;
  submissionCount: number;
  lastPeriodEnd: string | null;
  suppressedCellCount: number;
};

// --- Query implementations --------------------------------------------------

/**
 * Paginated list of recent submissions across all ministries, joined with
 * ministry name. `since`/`until` are inclusive-inclusive bounds on
 * period_start. Default limit 100, max 500.
 *
 * Privacy contract: no per-person data; suppressed-metric counts are
 * surfaced so the admin can see which submissions have cells below threshold.
 */
export async function listSubmissionsAcrossMinistries(opts: {
  since?: Date;
  until?: Date;
  limit?: number;
}): Promise<SubmissionSummary[]> {
  const { since, until, limit = 100 } = opts;
  const cappedLimit = Math.min(limit, 500);

  const conditions = [];
  if (since) conditions.push(gte(faithAggregateSubmissions.periodStart, toDateStr(since)));
  if (until) conditions.push(lte(faithAggregateSubmissions.periodStart, toDateStr(until)));

  const rows = await db
    .select({
      submission: faithAggregateSubmissions,
      ministryName: faithMinistries.name,
    })
    .from(faithAggregateSubmissions)
    .innerJoin(faithMinistries, eq(faithMinistries.id, faithAggregateSubmissions.ministryId))
    .where(conditions.length > 0 ? and(...(conditions as Parameters<typeof and>)) : undefined)
    .orderBy(desc(faithAggregateSubmissions.periodStart))
    .limit(cappedLimit);

  if (rows.length === 0) return [];

  const submissionIds = rows.map((r) => r.submission.id);
  const suppressedRows = await db
    .select({
      submissionId: faithAggregateMetrics.submissionId,
      suppressedCount: drizzleCount(faithAggregateMetrics.id),
    })
    .from(faithAggregateMetrics)
    .where(
      and(
        eq(faithAggregateMetrics.suppressed, true),
        inArray(faithAggregateMetrics.submissionId, submissionIds),
      ),
    )
    .groupBy(faithAggregateMetrics.submissionId);

  const suppressedMap = new Map<string, number>();
  for (const r of suppressedRows) suppressedMap.set(r.submissionId, Number(r.suppressedCount));

  return rows.map((r) => ({
    ...r.submission,
    ministryName: r.ministryName,
    suppressedMetricCount: suppressedMap.get(r.submission.id) ?? 0,
  }));
}

/**
 * For one ministry + one metric key, return one row per submission in the
 * window, ordered ASC by period_start — input for a per-metric line chart.
 *
 * Privacy contract: suppressed cells flow through as value=null,
 * suppressed=true. Do NOT reverse-engineer the suppressed value.
 */
export async function getMinistryTrendForMetric(
  ministryId: string,
  metricKey: FaithMetricKey,
  opts: { since?: Date; until?: Date } = {},
): Promise<MinistryTrendPoint[]> {
  const { since, until } = opts;

  const subConditions: Parameters<typeof and> = [
    eq(faithAggregateSubmissions.ministryId, ministryId),
  ];
  if (since) subConditions.push(gte(faithAggregateSubmissions.periodStart, toDateStr(since)));
  if (until) subConditions.push(lte(faithAggregateSubmissions.periodStart, toDateStr(until)));

  const rows = await db
    .select({
      periodStart: faithAggregateSubmissions.periodStart,
      periodEnd: faithAggregateSubmissions.periodEnd,
      value: faithAggregateMetrics.value,
      suppressed: faithAggregateMetrics.suppressed,
    })
    .from(faithAggregateSubmissions)
    .innerJoin(
      faithAggregateMetrics,
      and(
        eq(faithAggregateMetrics.submissionId, faithAggregateSubmissions.id),
        eq(faithAggregateMetrics.metricKey, metricKey),
      ),
    )
    .where(and(...subConditions))
    .orderBy(asc(faithAggregateSubmissions.periodStart));

  return rows.map((r) => ({
    periodStart: r.periodStart,
    periodEnd: r.periodEnd,
    value: r.value,
    suppressed: r.suppressed,
  }));
}

/**
 * For a window, return per-metric totals across all opted-in ministries.
 * Delegates aggregation to the pure helper `aggregateCoalitionMetricTotals`
 * so the logic can be unit-tested without a DB connection.
 *
 * Includes submissions whose period overlaps the window
 * (period_end >= periodStart AND period_start <= periodEnd).
 *
 * Privacy contract: suppressed cells are excluded from the sum and counted
 * toward `suppressedMinistries` — NOT treated as zero.
 */
export async function getCoalitionTotalsForPeriod(
  periodStart: Date,
  periodEnd: Date,
): Promise<CoalitionMetricTotal[]> {
  const startStr = toDateStr(periodStart);
  const endStr = toDateStr(periodEnd);

  const rows = await db
    .select({
      metricKey: faithAggregateMetrics.metricKey,
      value: faithAggregateMetrics.value,
      suppressed: faithAggregateMetrics.suppressed,
      ministryId: faithAggregateSubmissions.ministryId,
    })
    .from(faithAggregateMetrics)
    .innerJoin(
      faithAggregateSubmissions,
      eq(faithAggregateMetrics.submissionId, faithAggregateSubmissions.id),
    )
    .innerJoin(faithMinistries, eq(faithMinistries.id, faithAggregateSubmissions.ministryId))
    .where(
      and(
        eq(faithMinistries.status, 'opted_in'),
        gte(faithAggregateSubmissions.periodEnd, startStr),
        lte(faithAggregateSubmissions.periodStart, endStr),
      ),
    );

  return aggregateCoalitionMetricTotals(rows);
}

/**
 * Pure-function aggregation helper — extracted so it can be unit tested
 * without a DB connection. Respects the privacy contract:
 *
 * - Suppressed cells contribute to `suppressedMinistries`, not `totalValue`.
 * - A ministry is "reporting" only when it has at least one non-suppressed
 *   value for the metric in the window.
 * - If ALL a ministry's values for a metric are suppressed, it is counted
 *   in `suppressedMinistries` only.
 * - NEVER fabricates a value for a suppressed cell.
 */
export function aggregateCoalitionMetricTotals(
  rows: ReadonlyArray<{
    metricKey: string;
    value: number | null;
    suppressed: boolean;
    ministryId: string;
  }>,
): CoalitionMetricTotal[] {
  type Acc = {
    totalValue: number;
    reportingMinistryIds: Set<string>;
    suppressedOnlyMinistryIds: Set<string>;
  };

  const byMetric = new Map<string, Acc>();

  for (const row of rows) {
    if (!byMetric.has(row.metricKey)) {
      byMetric.set(row.metricKey, {
        totalValue: 0,
        reportingMinistryIds: new Set(),
        suppressedOnlyMinistryIds: new Set(),
      });
    }
    const acc = byMetric.get(row.metricKey)!;
    if (!row.suppressed && row.value !== null) {
      acc.totalValue += row.value;
      acc.reportingMinistryIds.add(row.ministryId);
      // Once a ministry has a non-suppressed value, lift it from suppressed set.
      acc.suppressedOnlyMinistryIds.delete(row.ministryId);
    } else if (row.suppressed && !acc.reportingMinistryIds.has(row.ministryId)) {
      acc.suppressedOnlyMinistryIds.add(row.ministryId);
    }
  }

  const out: CoalitionMetricTotal[] = [];
  for (const [metricKey, acc] of byMetric.entries()) {
    out.push({
      metricKey: metricKey as FaithMetricKey,
      totalValue: acc.totalValue,
      reportingMinistries: acc.reportingMinistryIds.size,
      suppressedMinistries: acc.suppressedOnlyMinistryIds.size,
    });
  }
  return out;
}

/**
 * Same shape as getCoalitionTotalsForPeriod but for demographic breakouts:
 * (dimension, bucket, totalValue, reportingMinistries, suppressedMinistries).
 *
 * Includes submissions whose period overlaps the window
 * (period_end >= periodStart AND period_start <= periodEnd).
 */
export async function getCoalitionBreakoutTotalsForPeriod(
  periodStart: Date,
  periodEnd: Date,
): Promise<CoalitionBreakoutTotal[]> {
  const startStr = toDateStr(periodStart);
  const endStr = toDateStr(periodEnd);

  const rows = await db
    .select({
      dimension: faithAggregateBreakouts.dimension,
      bucket: faithAggregateBreakouts.bucket,
      count: faithAggregateBreakouts.count,
      suppressed: faithAggregateBreakouts.suppressed,
      ministryId: faithAggregateSubmissions.ministryId,
    })
    .from(faithAggregateBreakouts)
    .innerJoin(
      faithAggregateSubmissions,
      eq(faithAggregateBreakouts.submissionId, faithAggregateSubmissions.id),
    )
    .innerJoin(faithMinistries, eq(faithMinistries.id, faithAggregateSubmissions.ministryId))
    .where(
      and(
        eq(faithMinistries.status, 'opted_in'),
        gte(faithAggregateSubmissions.periodEnd, startStr),
        lte(faithAggregateSubmissions.periodStart, endStr),
      ),
    );

  return aggregateCoalitionBreakoutTotals(rows);
}

/** Pure aggregation helper for breakout totals — mirrors aggregateCoalitionMetricTotals. */
export function aggregateCoalitionBreakoutTotals(
  rows: ReadonlyArray<{
    dimension: string;
    bucket: string;
    count: number | null;
    suppressed: boolean;
    ministryId: string;
  }>,
): CoalitionBreakoutTotal[] {
  type Acc = {
    totalValue: number;
    reportingMinistryIds: Set<string>;
    suppressedOnlyMinistryIds: Set<string>;
  };

  // Key: dimension + NUL + bucket (NUL cannot appear in these controlled-vocab strings).
  const byDimBucket = new Map<string, Acc>();

  for (const row of rows) {
    const key = `${row.dimension}\x00${row.bucket}`;
    if (!byDimBucket.has(key)) {
      byDimBucket.set(key, {
        totalValue: 0,
        reportingMinistryIds: new Set(),
        suppressedOnlyMinistryIds: new Set(),
      });
    }
    const acc = byDimBucket.get(key)!;
    if (!row.suppressed && row.count !== null) {
      acc.totalValue += row.count;
      acc.reportingMinistryIds.add(row.ministryId);
      acc.suppressedOnlyMinistryIds.delete(row.ministryId);
    } else if (row.suppressed && !acc.reportingMinistryIds.has(row.ministryId)) {
      acc.suppressedOnlyMinistryIds.add(row.ministryId);
    }
  }

  const out: CoalitionBreakoutTotal[] = [];
  for (const [key, acc] of byDimBucket.entries()) {
    const nulIdx = key.indexOf('\x00');
    const dimension = key.slice(0, nulIdx);
    const bucket = key.slice(nulIdx + 1);
    out.push({
      dimension,
      bucket,
      totalValue: acc.totalValue,
      reportingMinistries: acc.reportingMinistryIds.size,
      suppressedMinistries: acc.suppressedOnlyMinistryIds.size,
    });
  }
  return out;
}

/**
 * For one ministry, compare per-metric totals across two time windows.
 *
 * `currentPartial`/`priorPartial` are true when at least one cell in that
 * window was suppressed — the page can render an "(approx)" annotation so an
 * admin reading the table can tell when a delta is built on partial data.
 *
 * `deltaPct` is in **percent units** (e.g. `12.5` means +12.5%, not +0.125).
 * It is null when either window value is null (all-suppressed).
 */
export async function compareMinistryWindows(
  ministryId: string,
  currentStart: Date,
  currentEnd: Date,
  priorStart: Date,
  priorEnd: Date,
): Promise<WindowComparison[]> {
  const [currentTotals, priorTotals] = await Promise.all([
    fetchMinistryMetricTotals(ministryId, currentStart, currentEnd),
    fetchMinistryMetricTotals(ministryId, priorStart, priorEnd),
  ]);

  const allKeys = new Set([...currentTotals.keys(), ...priorTotals.keys()]);
  const out: WindowComparison[] = [];

  for (const metricKey of allKeys) {
    const currentEntry = currentTotals.get(metricKey);
    const priorEntry = priorTotals.get(metricKey);
    const current = currentEntry?.value ?? null;
    const currentPartial = currentEntry?.partial ?? false;
    const prior = priorEntry?.value ?? null;
    const priorPartial = priorEntry?.partial ?? false;
    // deltaPct is null if either window is unknown (all-suppressed).
    const deltaPct =
      current !== null && prior !== null && prior > 0
        ? Math.round(((current - prior) / prior) * 10000) / 100
        : null;
    out.push({
      metricKey: metricKey as FaithMetricKey,
      current,
      currentPartial,
      prior,
      priorPartial,
      deltaPct,
    });
  }

  return out;
}

export type MinistryMetricWindowEntry = {
  /** Sum of non-suppressed values; null if all cells were suppressed. */
  value: number | null;
  /** True when at least one cell in the window was suppressed. */
  partial: boolean;
};

/**
 * Pure-function aggregation helper for a single ministry's metric window —
 * extracted so it can be unit-tested without a DB connection.
 *
 * - All non-suppressed → `value: sum, partial: false`
 * - All suppressed → `value: null, partial: true`
 * - Mixed → `value: sum-of-non-suppressed, partial: true`
 */
export function aggregateMinistryMetricTotals(
  rows: ReadonlyArray<{
    metricKey: string;
    value: number | null;
    suppressed: boolean;
  }>,
): Map<string, MinistryMetricWindowEntry> {
  const acc = new Map<string, MinistryMetricWindowEntry>();
  for (const row of rows) {
    const existing = acc.get(row.metricKey);
    if (!row.suppressed && row.value !== null) {
      acc.set(row.metricKey, {
        value: (existing?.value ?? 0) + row.value,
        partial: existing?.partial ?? false,
      });
    } else if (row.suppressed) {
      if (existing === undefined) {
        // First encounter: suppressed, no value yet.
        acc.set(row.metricKey, { value: null, partial: true });
      } else {
        // There may already be a numeric value from a non-suppressed cell —
        // keep it, just mark the window as partial.
        acc.set(row.metricKey, { value: existing.value, partial: true });
      }
    }
  }
  return acc;
}

/**
 * Fetch and aggregate non-suppressed metric values for one ministry in a window.
 * Uses overlap semantics: submissions whose period overlaps the window
 * (period_end >= periodStart AND period_start <= periodEnd) are included.
 *
 * Returns a Map<metricKey, MinistryMetricWindowEntry> where:
 * - `value: null` means the window contained only suppressed values (unknown total).
 * - `partial: true` means at least one cell was suppressed.
 */
async function fetchMinistryMetricTotals(
  ministryId: string,
  periodStart: Date,
  periodEnd: Date,
): Promise<Map<string, MinistryMetricWindowEntry>> {
  const startStr = toDateStr(periodStart);
  const endStr = toDateStr(periodEnd);

  const rows = await db
    .select({
      metricKey: faithAggregateMetrics.metricKey,
      value: faithAggregateMetrics.value,
      suppressed: faithAggregateMetrics.suppressed,
    })
    .from(faithAggregateMetrics)
    .innerJoin(
      faithAggregateSubmissions,
      eq(faithAggregateMetrics.submissionId, faithAggregateSubmissions.id),
    )
    .where(
      and(
        eq(faithAggregateSubmissions.ministryId, ministryId),
        gte(faithAggregateSubmissions.periodEnd, startStr),
        lte(faithAggregateSubmissions.periodStart, endStr),
      ),
    );

  return aggregateMinistryMetricTotals(rows);
}

/**
 * Per-ministry summary for the admin insights table: submission count,
 * last period_end, and suppressed-cell count across all child metrics
 * within the trailing window.
 */
export async function listMinistryInsightRows(opts: {
  since: Date;
}): Promise<MinistryInsightRow[]> {
  const sinceStr = toDateStr(opts.since);

  const ministries = await listFaithMinistries({ status: 'opted_in' });
  if (ministries.length === 0) return [];

  const submissionRows = await db
    .select({
      ministryId: faithAggregateSubmissions.ministryId,
      submissionId: faithAggregateSubmissions.id,
      periodEnd: faithAggregateSubmissions.periodEnd,
    })
    .from(faithAggregateSubmissions)
    .where(
      and(
        inArray(
          faithAggregateSubmissions.ministryId,
          ministries.map((m) => m.id),
        ),
        gte(faithAggregateSubmissions.periodStart, sinceStr),
      ),
    );

  const submissionIds = submissionRows.map((r) => r.submissionId);

  const suppressedCellRows =
    submissionIds.length > 0
      ? await db
          .select({
            submissionId: faithAggregateMetrics.submissionId,
            suppressedCount: drizzleCount(faithAggregateMetrics.id),
          })
          .from(faithAggregateMetrics)
          .where(
            and(
              eq(faithAggregateMetrics.suppressed, true),
              inArray(faithAggregateMetrics.submissionId, submissionIds),
            ),
          )
          .groupBy(faithAggregateMetrics.submissionId)
      : [];

  const suppressedBySubmission = new Map<string, number>();
  for (const r of suppressedCellRows)
    suppressedBySubmission.set(r.submissionId, Number(r.suppressedCount));

  type MinistryAcc = {
    submissionCount: number;
    lastPeriodEnd: string | null;
    suppressedCellCount: number;
  };
  const byMinistry = new Map<string, MinistryAcc>();

  for (const r of submissionRows) {
    const existing = byMinistry.get(r.ministryId) ?? {
      submissionCount: 0,
      lastPeriodEnd: null,
      suppressedCellCount: 0,
    };
    existing.submissionCount += 1;
    if (!existing.lastPeriodEnd || r.periodEnd > existing.lastPeriodEnd) {
      existing.lastPeriodEnd = r.periodEnd;
    }
    existing.suppressedCellCount += suppressedBySubmission.get(r.submissionId) ?? 0;
    byMinistry.set(r.ministryId, existing);
  }

  return ministries.map((m) => {
    const acc = byMinistry.get(m.id);
    return {
      id: m.id,
      name: m.name,
      submissionCount: acc?.submissionCount ?? 0,
      lastPeriodEnd: acc?.lastPeriodEnd ?? null,
      suppressedCellCount: acc?.suppressedCellCount ?? 0,
    };
  });
}
