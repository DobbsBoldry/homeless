import { describe, expect, it } from 'vitest';
import {
  aggregateCaseworkerWeekly,
  buildWeeklyTrend,
  type CaseNoteActivity,
  computePerCaseDeltas,
  computeTimeSavedMetrics,
  weekStartUtc,
} from './time-saved-metric';

const d = (iso: string) => new Date(iso);

function note(ref: string, user: string, iso: string, draftedByAi: boolean): CaseNoteActivity {
  return { syntheticPersonRef: ref, createdByUserId: user, createdAt: d(iso), draftedByAi };
}

describe('weekStartUtc', () => {
  it('maps any weekday to the preceding Monday (UTC)', () => {
    // 2026-06-22 is a Monday.
    expect(weekStartUtc(d('2026-06-22T00:00:00Z'))).toBe('2026-06-22');
    expect(weekStartUtc(d('2026-06-22T23:59:59Z'))).toBe('2026-06-22');
    expect(weekStartUtc(d('2026-06-24T12:00:00Z'))).toBe('2026-06-22'); // Wed
    expect(weekStartUtc(d('2026-06-28T23:00:00Z'))).toBe('2026-06-22'); // Sun
    expect(weekStartUtc(d('2026-06-29T00:00:00Z'))).toBe('2026-06-29'); // next Mon
  });
});

describe('computePerCaseDeltas', () => {
  it('derives case-open and first-AI-draft per ref and the minute delta', () => {
    const notes = [
      note('p1', 'cw1', '2026-06-22T09:00:00Z', false), // case opened
      note('p1', 'cw1', '2026-06-22T10:30:00Z', true), // first AI draft (+90m)
      note('p1', 'cw1', '2026-06-22T11:00:00Z', false), // later edit
    ];
    const deltas = computePerCaseDeltas(notes);
    expect(deltas).toHaveLength(1);
    expect(deltas[0].syntheticPersonRef).toBe('p1');
    expect(deltas[0].caseOpenAt.toISOString()).toBe('2026-06-22T09:00:00.000Z');
    expect(deltas[0].firstAiDraftAt.toISOString()).toBe('2026-06-22T10:30:00.000Z');
    expect(deltas[0].draftCaseworkerId).toBe('cw1');
    expect(deltas[0].deltaMinutes).toBe(90);
  });

  it('excludes cases that never received an AI draft', () => {
    const notes = [
      note('p2', 'cw1', '2026-06-22T09:00:00Z', false),
      note('p2', 'cw1', '2026-06-22T10:00:00Z', false),
    ];
    expect(computePerCaseDeltas(notes)).toHaveLength(0);
  });

  it('yields delta 0 when the first note is itself the AI draft', () => {
    const notes = [note('p3', 'cw1', '2026-06-22T09:00:00Z', true)];
    const deltas = computePerCaseDeltas(notes);
    expect(deltas).toHaveLength(1);
    expect(deltas[0].deltaMinutes).toBe(0);
  });

  it('uses the earliest AI draft when several exist', () => {
    const notes = [
      note('p4', 'cw1', '2026-06-22T08:00:00Z', false),
      note('p4', 'cw1', '2026-06-22T09:00:00Z', true), // earliest AI (+60m)
      note('p4', 'cw2', '2026-06-22T12:00:00Z', true),
    ];
    const deltas = computePerCaseDeltas(notes);
    expect(deltas[0].deltaMinutes).toBe(60);
    expect(deltas[0].draftCaseworkerId).toBe('cw1');
  });

  it('attributes the delta to the caseworker who authored the first AI draft', () => {
    const notes = [
      note('p5', 'cwOpener', '2026-06-22T08:00:00Z', false),
      note('p5', 'cwDrafter', '2026-06-22T10:00:00Z', true),
    ];
    expect(computePerCaseDeltas(notes)[0].draftCaseworkerId).toBe('cwDrafter');
  });

  it('is order-independent (unsorted input)', () => {
    const notes = [
      note('p6', 'cw1', '2026-06-22T10:30:00Z', true),
      note('p6', 'cw1', '2026-06-22T09:00:00Z', false),
    ];
    const deltas = computePerCaseDeltas(notes);
    expect(deltas[0].caseOpenAt.toISOString()).toBe('2026-06-22T09:00:00.000Z');
    expect(deltas[0].deltaMinutes).toBe(90);
  });
});

describe('aggregateCaseworkerWeekly', () => {
  it('groups by caseworker and week, case-weighted average', () => {
    const notes = [
      // cw1, week of 2026-06-22: two cases, deltas 60 and 120 -> avg 90
      note('a', 'cw1', '2026-06-22T08:00:00Z', false),
      note('a', 'cw1', '2026-06-22T09:00:00Z', true),
      note('b', 'cw1', '2026-06-23T08:00:00Z', false),
      note('b', 'cw1', '2026-06-23T10:00:00Z', true),
      // cw2, same week: one case, delta 30
      note('c', 'cw2', '2026-06-24T08:00:00Z', false),
      note('c', 'cw2', '2026-06-24T08:30:00Z', true),
    ];
    const rows = aggregateCaseworkerWeekly(computePerCaseDeltas(notes));
    const cw1 = rows.find((r) => r.caseworkerId === 'cw1');
    const cw2 = rows.find((r) => r.caseworkerId === 'cw2');
    expect(cw1).toMatchObject({ weekStart: '2026-06-22', caseCount: 2, avgMinutesToDraft: 90 });
    expect(cw2).toMatchObject({ weekStart: '2026-06-22', caseCount: 1, avgMinutesToDraft: 30 });
  });

  it('separates the same caseworker across different weeks', () => {
    const notes = [
      note('a', 'cw1', '2026-06-22T08:00:00Z', false),
      note('a', 'cw1', '2026-06-22T09:00:00Z', true),
      note('b', 'cw1', '2026-06-29T08:00:00Z', false),
      note('b', 'cw1', '2026-06-29T09:00:00Z', true),
    ];
    const rows = aggregateCaseworkerWeekly(computePerCaseDeltas(notes));
    expect(rows).toHaveLength(2);
    expect(rows.map((r) => r.weekStart)).toEqual(['2026-06-29', '2026-06-22']); // week desc
  });
});

describe('buildWeeklyTrend', () => {
  it('produces a contiguous, zero-filled series ending at the anchor week', () => {
    const trend = buildWeeklyTrend([], { weeks: 4, anchorWeekStart: '2026-06-22' });
    expect(trend.map((p) => p.weekStart)).toEqual([
      '2026-06-01',
      '2026-06-08',
      '2026-06-15',
      '2026-06-22',
    ]);
    expect(trend.every((p) => p.caseCount === 0 && p.avgMinutesToDraft === null)).toBe(true);
  });

  it('computes weekly average and a trailing 4-week rolling average (case-weighted)', () => {
    const notes = [
      // week 2026-06-08: one case, delta 60
      note('a', 'cw1', '2026-06-08T08:00:00Z', false),
      note('a', 'cw1', '2026-06-08T09:00:00Z', true),
      // week 2026-06-22: two cases, deltas 30 and 90 -> weekly avg 60
      note('b', 'cw1', '2026-06-22T08:00:00Z', false),
      note('b', 'cw1', '2026-06-22T08:30:00Z', true),
      note('c', 'cw1', '2026-06-22T08:00:00Z', false),
      note('c', 'cw1', '2026-06-22T09:30:00Z', true),
    ];
    const trend = buildWeeklyTrend(computePerCaseDeltas(notes), {
      weeks: 4,
      anchorWeekStart: '2026-06-22',
    });
    const last = trend[trend.length - 1];
    expect(last.weekStart).toBe('2026-06-22');
    expect(last.caseCount).toBe(2);
    expect(last.avgMinutesToDraft).toBe(60);
    // Rolling over 2026-06-01..22: 3 cases total (60 + 30 + 90 = 180) / 3 = 60
    expect(last.rolling4WeekAvgMinutes).toBe(60);
    // The empty middle week reports null weekly avg but a non-null rolling avg.
    const wk0615 = trend.find((p) => p.weekStart === '2026-06-15');
    expect(wk0615?.avgMinutesToDraft).toBeNull();
    expect(wk0615?.rolling4WeekAvgMinutes).toBe(60); // only the 06-08 case in its trailing window
  });
});

describe('computeTimeSavedMetrics', () => {
  it('assembles caseworker rows, trend, current week, and overall average', () => {
    const notes = [
      note('a', 'cw1', '2026-06-22T08:00:00Z', false),
      note('a', 'cw1', '2026-06-22T09:00:00Z', true), // 60
      note('b', 'cw2', '2026-06-22T08:00:00Z', false),
      note('b', 'cw2', '2026-06-22T10:00:00Z', true), // 120
    ];
    const m = computeTimeSavedMetrics(notes, { trendWeeks: 8, now: d('2026-06-24T12:00:00Z') });
    expect(m.currentWeekStart).toBe('2026-06-22');
    expect(m.totalCasesMeasured).toBe(2);
    expect(m.overallAvgMinutesToDraft).toBe(90); // (60 + 120) / 2
    expect(m.weeklyTrend).toHaveLength(8);
    expect(m.weeklyTrend[m.weeklyTrend.length - 1].weekStart).toBe('2026-06-22');
    expect(m.caseworkerWeekly).toHaveLength(2);
  });

  it('handles empty activity without dividing by zero', () => {
    const m = computeTimeSavedMetrics([], { trendWeeks: 4, now: d('2026-06-24T12:00:00Z') });
    expect(m.totalCasesMeasured).toBe(0);
    expect(m.overallAvgMinutesToDraft).toBeNull();
    expect(m.caseworkerWeekly).toEqual([]);
    expect(m.weeklyTrend).toHaveLength(4);
  });
});
