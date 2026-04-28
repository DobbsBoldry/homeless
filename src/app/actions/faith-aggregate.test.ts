/**
 * Unit tests for the `parseIntakeFormData` helper from the DTRS-008 server action.
 *
 * We test the pure parsing function directly — no mocking of auth or DB
 * required. The DB-layer and suppression logic are already covered by
 * DTRS-007's tests. The `submitFaithAggregateAction` itself is just a thin
 * wrapper: parse → requireRole → createFaithAggregateSubmission.
 */
import { describe, expect, it } from 'vitest';
import { parseIntakeFormData } from './faith-aggregate-parse';

function makeFormData(overrides: Record<string, string> = {}): FormData {
  const fd = new FormData();
  fd.set('ministryId', 'min-uuid-001');
  fd.set('periodKind', 'month');
  fd.set('periodStart', '2026-04-01');
  fd.set('periodEnd', '2026-04-30');
  for (const [k, v] of Object.entries(overrides)) {
    fd.set(k, v);
  }
  return fd;
}

describe('parseIntakeFormData', () => {
  it('rejects missing ministryId', () => {
    const r = parseIntakeFormData(makeFormData({ ministryId: '' }));
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.error).toMatch(/ministry/i);
  });

  it('rejects invalid periodKind', () => {
    const r = parseIntakeFormData(makeFormData({ periodKind: 'biannual' }));
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.error).toMatch(/period kind/i);
  });

  it('rejects missing periodStart', () => {
    const r = parseIntakeFormData(makeFormData({ periodStart: '' }));
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.error).toMatch(/period/i);
  });

  it('rejects a negative metric value', () => {
    const r = parseIntakeFormData(makeFormData({ metric_meals_served: '-5' }));
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.error).toMatch(/meals_served/);
  });

  it('rejects a non-integer metric value', () => {
    const r = parseIntakeFormData(makeFormData({ metric_meals_served: '12.5' }));
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.error).toMatch(/meals_served/);
  });

  it('omits metrics whose fields are left blank (not reported)', () => {
    const r = parseIntakeFormData(makeFormData({ metric_meals_served: '250' }));
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.input.metrics).toEqual([{ metricKey: 'meals_served', value: 250 }]);
  });

  it('includes a metric with value 0 (explicitly zero)', () => {
    const r = parseIntakeFormData(makeFormData({ metric_visits_total: '0' }));
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.input.metrics).toEqual([{ metricKey: 'visits_total', value: 0 }]);
  });

  it('parses breakout entries', () => {
    const r = parseIntakeFormData(makeFormData({ breakout_age_band_under_18: '45' }));
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.input.breakouts).toEqual([{ dimension: 'age_band', bucket: 'under_18', count: 45 }]);
  });

  it('passes notes through when provided', () => {
    const r = parseIntakeFormData(
      makeFormData({ notes: 'April data — Lenten meal program included' }),
    );
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.input.notes).toBe('April data — Lenten meal program included');
  });

  it('treats empty notes as null', () => {
    const r = parseIntakeFormData(makeFormData({ notes: '   ' }));
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.input.notes).toBeNull();
  });

  it('rejects notes longer than 2000 chars', () => {
    const r = parseIntakeFormData(makeFormData({ notes: 'a'.repeat(2001) }));
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.error).toMatch(/2 000/);
  });

  it('passes all three period kinds through', () => {
    for (const kind of ['week', 'month', 'quarter'] as const) {
      const r = parseIntakeFormData(makeFormData({ periodKind: kind }));
      expect(r.ok).toBe(true);
      if (!r.ok) continue;
      expect(r.input.periodKind).toBe(kind);
    }
  });

  it('parses periodStart and periodEnd as Date objects', () => {
    const r = parseIntakeFormData(makeFormData());
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.input.periodStart).toBeInstanceOf(Date);
    expect(r.input.periodEnd).toBeInstanceOf(Date);
  });

  it('rejects a negative breakout count', () => {
    const r = parseIntakeFormData(makeFormData({ breakout_gender_male: '-1' }));
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.error).toMatch(/gender/);
  });
});
