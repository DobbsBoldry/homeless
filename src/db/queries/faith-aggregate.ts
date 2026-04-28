import { desc, count as drizzleCount, eq } from 'drizzle-orm';
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
