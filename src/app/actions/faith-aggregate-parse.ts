/**
 * Pure FormData parser for the DTRS-008 faith-aggregate intake form.
 *
 * Kept in a separate file (no 'use server' directive) so it can be
 * imported and unit-tested by vitest without Next.js server-action
 * wrapping. The action file (`faith-aggregate.ts`) re-exports the types
 * and delegates to this function.
 */
import type { FaithAggregatePeriodKind } from '@/db/schema/enums';
import { FAITH_BREAKOUT_DIMENSIONS, FAITH_METRIC_KEYS } from '@/lib/dtrs';

export type ParsedIntakeInput = {
  ministryId: string;
  periodKind: FaithAggregatePeriodKind;
  periodStart: Date;
  periodEnd: Date;
  notes: string | null;
  metrics: Array<{ metricKey: string; value: number }>;
  breakouts: Array<{ dimension: string; bucket: string; count: number }>;
};

/**
 * Parse + validate a FormData from the faith-aggregate intake form.
 *
 * FormData shape (all values are strings; empty = not reported):
 *   ministryId     — uuid
 *   periodKind     — 'week' | 'month' | 'quarter'
 *   periodStart    — YYYY-MM-DD
 *   periodEnd      — YYYY-MM-DD
 *   notes          — optional freetext (no individual identifiers)
 *   metric_{key}   — one per FAITH_METRIC_KEYS; empty = omit; "0" = zero
 *   breakout_{dim}_{bucket} — per FAITH_BREAKOUT_DIMENSIONS; empty = omit
 */
export function parseIntakeFormData(
  formData: FormData,
): { ok: true; input: ParsedIntakeInput } | { ok: false; error: string } {
  // FormData.get() returns null in browsers, undefined in Node — normalise with ?? ''.
  const ministryId = (formData.get('ministryId') ?? '').toString().trim();
  if (!ministryId) return { ok: false, error: 'Ministry is required.' };

  const periodKindRaw = (formData.get('periodKind') ?? '').toString().trim();
  const PERIOD_KINDS: readonly FaithAggregatePeriodKind[] = ['week', 'month', 'quarter'];
  if (!periodKindRaw || !PERIOD_KINDS.includes(periodKindRaw as FaithAggregatePeriodKind)) {
    return { ok: false, error: 'Period kind must be week, month, or quarter.' };
  }
  const periodKind = periodKindRaw as FaithAggregatePeriodKind;

  const periodStartStr = (formData.get('periodStart') ?? '').toString().trim();
  const periodEndStr = (formData.get('periodEnd') ?? '').toString().trim();
  if (!periodStartStr || !periodEndStr) {
    return { ok: false, error: 'Period start and end are required.' };
  }
  const periodStart = new Date(periodStartStr);
  const periodEnd = new Date(periodEndStr);
  if (Number.isNaN(periodStart.getTime()) || Number.isNaN(periodEnd.getTime())) {
    return { ok: false, error: 'Period dates are invalid.' };
  }

  const notesRaw = (formData.get('notes') ?? '').toString().trim();
  const notes = notesRaw.length > 0 ? notesRaw : null;
  if (notes && notes.length > 2000) {
    return { ok: false, error: 'Notes must be 2 000 characters or fewer.' };
  }

  // Metrics: empty field = not reported (omit); "0" = explicitly zero.
  // Note: FormData.get() returns null in browsers but undefined in Node —
  // normalise both to a skip.
  const metrics: Array<{ metricKey: string; value: number }> = [];
  for (const key of FAITH_METRIC_KEYS) {
    const raw = formData.get(`metric_${key}`);
    const str = raw != null ? String(raw).trim() : '';
    if (str === '') continue;
    const parsed = Number(str);
    if (!Number.isInteger(parsed) || parsed < 0) {
      return { ok: false, error: `Metric "${key}" must be a non-negative whole number.` };
    }
    metrics.push({ metricKey: key, value: parsed });
  }

  // Breakouts: same empty = omit semantics.
  const breakouts: Array<{ dimension: string; bucket: string; count: number }> = [];
  for (const [dim, buckets] of Object.entries(FAITH_BREAKOUT_DIMENSIONS)) {
    for (const bucket of buckets) {
      const raw = formData.get(`breakout_${dim}_${bucket}`);
      const str = raw != null ? String(raw).trim() : '';
      if (str === '') continue;
      const parsed = Number(str);
      if (!Number.isInteger(parsed) || parsed < 0) {
        return {
          ok: false,
          error: `Breakout "${dim} / ${bucket}" must be a non-negative whole number.`,
        };
      }
      breakouts.push({ dimension: dim, bucket, count: parsed });
    }
  }

  return {
    ok: true,
    input: { ministryId, periodKind, periodStart, periodEnd, notes, metrics, breakouts },
  };
}
