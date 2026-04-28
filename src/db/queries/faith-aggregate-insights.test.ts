import { describe, expect, it } from 'vitest';
import {
  aggregateCoalitionBreakoutTotals,
  aggregateCoalitionMetricTotals,
} from './faith-aggregate';

// ---------------------------------------------------------------------------
// Unit tests for DTRS-009 aggregation helpers.
//
// These are pure-function tests — no DB connection required. The helpers
// are extracted from the query functions precisely so the privacy-contract
// logic can be verified in isolation (ADR 0003: suppressed cells must not
// be treated as zero or reverse-engineered).
// ---------------------------------------------------------------------------

describe('aggregateCoalitionMetricTotals', () => {
  it('sums non-suppressed values across ministries', () => {
    const rows = [
      { metricKey: 'meals_served', value: 100, suppressed: false, ministryId: 'min-A' },
      { metricKey: 'meals_served', value: 50, suppressed: false, ministryId: 'min-B' },
    ];
    const result = aggregateCoalitionMetricTotals(rows);
    const ms = result.find((r) => r.metricKey === 'meals_served');
    expect(ms?.totalValue).toBe(150);
    expect(ms?.reportingMinistries).toBe(2);
    expect(ms?.suppressedMinistries).toBe(0);
  });

  it('does not add suppressed cells to totalValue', () => {
    const rows = [
      { metricKey: 'meals_served', value: 100, suppressed: false, ministryId: 'min-A' },
      // min-B is suppressed — should not contribute to totalValue
      { metricKey: 'meals_served', value: null, suppressed: true, ministryId: 'min-B' },
    ];
    const result = aggregateCoalitionMetricTotals(rows);
    const ms = result.find((r) => r.metricKey === 'meals_served');
    expect(ms?.totalValue).toBe(100);
    expect(ms?.reportingMinistries).toBe(1);
    expect(ms?.suppressedMinistries).toBe(1);
  });

  it('treats a ministry as reporting if ANY value in the window is non-suppressed', () => {
    // min-A has two periods: one suppressed, one not.
    const rows = [
      { metricKey: 'visits_total', value: null, suppressed: true, ministryId: 'min-A' },
      { metricKey: 'visits_total', value: 20, suppressed: false, ministryId: 'min-A' },
    ];
    const result = aggregateCoalitionMetricTotals(rows);
    const vt = result.find((r) => r.metricKey === 'visits_total');
    expect(vt?.totalValue).toBe(20);
    expect(vt?.reportingMinistries).toBe(1);
    expect(vt?.suppressedMinistries).toBe(0);
  });

  it('counts a ministry as suppressedOnly if ALL its cells are suppressed', () => {
    const rows = [
      { metricKey: 'first_time_visits', value: null, suppressed: true, ministryId: 'min-X' },
      { metricKey: 'first_time_visits', value: null, suppressed: true, ministryId: 'min-X' },
      { metricKey: 'first_time_visits', value: 30, suppressed: false, ministryId: 'min-Y' },
    ];
    const result = aggregateCoalitionMetricTotals(rows);
    const ftv = result.find((r) => r.metricKey === 'first_time_visits');
    expect(ftv?.totalValue).toBe(30);
    expect(ftv?.reportingMinistries).toBe(1);
    expect(ftv?.suppressedMinistries).toBe(1);
  });

  it('handles an empty input gracefully', () => {
    expect(aggregateCoalitionMetricTotals([])).toEqual([]);
  });

  it('handles multiple metrics independently', () => {
    const rows = [
      { metricKey: 'meals_served', value: 200, suppressed: false, ministryId: 'min-A' },
      { metricKey: 'beds_provided', value: null, suppressed: true, ministryId: 'min-A' },
      { metricKey: 'beds_provided', value: 10, suppressed: false, ministryId: 'min-B' },
    ];
    const result = aggregateCoalitionMetricTotals(rows);

    const ms = result.find((r) => r.metricKey === 'meals_served');
    expect(ms?.totalValue).toBe(200);
    expect(ms?.reportingMinistries).toBe(1);
    expect(ms?.suppressedMinistries).toBe(0);

    const bp = result.find((r) => r.metricKey === 'beds_provided');
    expect(bp?.totalValue).toBe(10);
    expect(bp?.reportingMinistries).toBe(1);
    expect(bp?.suppressedMinistries).toBe(1);
  });
});

describe('aggregateCoalitionBreakoutTotals', () => {
  it('sums non-suppressed breakout counts', () => {
    const rows = [
      {
        dimension: 'age_band',
        bucket: 'under_18',
        count: 15,
        suppressed: false,
        ministryId: 'min-A',
      },
      {
        dimension: 'age_band',
        bucket: 'under_18',
        count: 12,
        suppressed: false,
        ministryId: 'min-B',
      },
    ];
    const result = aggregateCoalitionBreakoutTotals(rows);
    const cell = result.find((r) => r.dimension === 'age_band' && r.bucket === 'under_18');
    expect(cell?.totalValue).toBe(27);
    expect(cell?.reportingMinistries).toBe(2);
    expect(cell?.suppressedMinistries).toBe(0);
  });

  it('does not add suppressed breakout cells to totalValue', () => {
    const rows = [
      {
        dimension: 'gender',
        bucket: 'male',
        count: 40,
        suppressed: false,
        ministryId: 'min-A',
      },
      {
        dimension: 'gender',
        bucket: 'male',
        count: null,
        suppressed: true,
        ministryId: 'min-B',
      },
    ];
    const result = aggregateCoalitionBreakoutTotals(rows);
    const cell = result.find((r) => r.dimension === 'gender' && r.bucket === 'male');
    expect(cell?.totalValue).toBe(40);
    expect(cell?.reportingMinistries).toBe(1);
    expect(cell?.suppressedMinistries).toBe(1);
  });

  it('handles empty input', () => {
    expect(aggregateCoalitionBreakoutTotals([])).toEqual([]);
  });
});
