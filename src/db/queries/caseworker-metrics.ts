import { db } from '@/db/client';
import { clientCaseNotes } from '@/db/schema/client-case-notes';
import { users } from '@/db/schema/users';
import { computeTimeSavedMetrics, type WeeklyTrendPoint } from '@/lib/cwt';

/** Default number of weeks shown on the trend chart. */
export const TIME_SAVED_TREND_WEEKS = 8;

export interface CaseworkerWeekDisplayRow {
  caseworkerId: string;
  caseworkerName: string;
  caseCount: number;
  avgMinutesToDraft: number;
}

export interface CaseworkerTimeSavedMetrics {
  /** Per-caseworker rows for the most-recent (current) week. */
  currentWeekRows: CaseworkerWeekDisplayRow[];
  /** ISO week start (YYYY-MM-DD) of the current week. */
  currentWeekStart: string;
  /** Coalition-wide weekly trend with 4-week rolling average. */
  weeklyTrend: WeeklyTrendPoint[];
  /** Total cases measured (case-open → first AI draft) across all activity. */
  totalCasesMeasured: number;
  /** Case-weighted overall average minutes-to-draft; null when no cases. */
  overallAvgMinutesToDraft: number | null;
}

function displayName(u: {
  firstName: string | null;
  lastName: string | null;
  email: string;
}): string {
  const full = [u.firstName, u.lastName].filter(Boolean).join(' ').trim();
  return full || u.email;
}

/**
 * CWT-026 — coalition aggregate of caseworker time-to-first-AI-draft.
 *
 * Both timestamps are derived from `client_case_notes` (see
 * `src/lib/cwt/time-saved-metric.ts`); no denormalized columns. At pilot /
 * synthetic scale we read the note activity in full and aggregate in the pure
 * helper, which keeps the logic unit-testable. If the notes table grows large,
 * move the per-ref open/first-draft reduction into SQL (a grouped CTE) and feed
 * the helper the reduced rows instead.
 */
export async function getCaseworkerTimeSavedMetrics(
  trendWeeks = TIME_SAVED_TREND_WEEKS,
): Promise<CaseworkerTimeSavedMetrics> {
  const [notes, userRows] = await Promise.all([
    db
      .select({
        syntheticPersonRef: clientCaseNotes.syntheticPersonRef,
        createdByUserId: clientCaseNotes.createdByUserId,
        createdAt: clientCaseNotes.createdAt,
        draftedByAi: clientCaseNotes.draftedByAi,
      })
      .from(clientCaseNotes),
    db
      .select({
        id: users.id,
        firstName: users.firstName,
        lastName: users.lastName,
        email: users.email,
      })
      .from(users),
  ]);

  const nameById = new Map(userRows.map((u) => [u.id, displayName(u)]));

  const metrics = computeTimeSavedMetrics(notes, { trendWeeks, now: new Date() });

  const currentWeekRows: CaseworkerWeekDisplayRow[] = metrics.caseworkerWeekly
    .filter((r) => r.weekStart === metrics.currentWeekStart)
    .map((r) => ({
      caseworkerId: r.caseworkerId,
      caseworkerName: nameById.get(r.caseworkerId) ?? r.caseworkerId,
      caseCount: r.caseCount,
      avgMinutesToDraft: r.avgMinutesToDraft,
    }))
    .sort((a, b) => b.caseCount - a.caseCount || a.caseworkerName.localeCompare(b.caseworkerName));

  return {
    currentWeekRows,
    currentWeekStart: metrics.currentWeekStart,
    weeklyTrend: metrics.weeklyTrend,
    totalCasesMeasured: metrics.totalCasesMeasured,
    overallAvgMinutesToDraft: metrics.overallAvgMinutesToDraft,
  };
}
