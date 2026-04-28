import { describe, expect, it } from 'vitest';
import {
  applySuppression,
  FAITH_BREAKOUT_DIMENSIONS,
  FAITH_METRIC_KEYS,
  processBreakouts,
  processMetrics,
  validatePeriod,
} from './faith-aggregate';

describe('applySuppression', () => {
  it('suppresses values below the threshold', () => {
    expect(applySuppression(9, 10)).toEqual({ value: null, suppressed: true });
    expect(applySuppression(0, 10)).toEqual({ value: null, suppressed: true });
    expect(applySuppression(1, 10)).toEqual({ value: null, suppressed: true });
  });

  it('passes values at or above the threshold', () => {
    expect(applySuppression(10, 10)).toEqual({ value: 10, suppressed: false });
    expect(applySuppression(99, 10)).toEqual({ value: 99, suppressed: false });
  });

  it('respects ministry-specific threshold', () => {
    expect(applySuppression(20, 25)).toEqual({ value: null, suppressed: true });
    expect(applySuppression(25, 25)).toEqual({ value: 25, suppressed: false });
  });

  it('rejects bad input', () => {
    expect(() => applySuppression(-1, 10)).toThrow('non-negative');
    expect(() => applySuppression(1.5, 10)).toThrow('non-negative integer');
    expect(() => applySuppression(10, 0)).toThrow('positive integer');
    expect(() => applySuppression(10, -1)).toThrow('positive integer');
  });
});

describe('processMetrics', () => {
  it('applies suppression and validates metric_key', () => {
    const out = processMetrics(
      [
        { metricKey: 'meals_served', value: 250 },
        { metricKey: 'first_time_visits', value: 4 },
      ],
      10,
    );
    expect(out).toEqual([
      { metricKey: 'meals_served', value: 250, suppressed: false },
      { metricKey: 'first_time_visits', value: null, suppressed: true },
    ]);
  });

  it('rejects unknown metric_key', () => {
    expect(() => processMetrics([{ metricKey: 'mystery_count', value: 100 }], 10)).toThrow(
      'unknown metric_key: mystery_count',
    );
  });

  it('every key in FAITH_METRIC_KEYS is acceptable', () => {
    for (const k of FAITH_METRIC_KEYS) {
      const out = processMetrics([{ metricKey: k, value: 100 }], 10);
      expect(out[0]).toMatchObject({ metricKey: k, value: 100, suppressed: false });
    }
  });
});

describe('processBreakouts', () => {
  it('applies suppression and validates dimension+bucket', () => {
    const out = processBreakouts(
      [
        { dimension: 'age_band', bucket: '25_44', count: 60 },
        { dimension: 'gender', bucket: 'female', count: 7 },
      ],
      10,
    );
    expect(out).toEqual([
      { dimension: 'age_band', bucket: '25_44', count: 60, suppressed: false },
      { dimension: 'gender', bucket: 'female', count: null, suppressed: true },
    ]);
  });

  it('rejects unknown dimension', () => {
    expect(() =>
      processBreakouts([{ dimension: 'eye_color', bucket: 'blue', count: 50 }], 10),
    ).toThrow('unknown dimension: eye_color');
  });

  it('rejects bucket not in dimension allowlist', () => {
    expect(() =>
      processBreakouts([{ dimension: 'gender', bucket: 'martian', count: 50 }], 10),
    ).toThrow('unknown bucket "martian" for dimension "gender"');
  });

  it('every (dimension, bucket) combo in the controlled vocab is acceptable', () => {
    for (const [dim, buckets] of Object.entries(FAITH_BREAKOUT_DIMENSIONS)) {
      for (const bucket of buckets) {
        const out = processBreakouts([{ dimension: dim, bucket, count: 50 }], 10);
        expect(out[0]).toMatchObject({ dimension: dim, bucket, count: 50, suppressed: false });
      }
    }
  });
});

describe('validatePeriod', () => {
  it('accepts well-formed periods', () => {
    expect(() => validatePeriod(new Date('2026-04-01'), new Date('2026-04-07'))).not.toThrow();
    expect(() => validatePeriod(new Date('2026-04-01'), new Date('2026-04-01'))).not.toThrow(); // single-day period is fine
  });

  it('rejects start after end', () => {
    expect(() => validatePeriod(new Date('2026-04-08'), new Date('2026-04-01'))).toThrow(
      'must be <= period_end',
    );
  });

  it('rejects invalid dates', () => {
    expect(() => validatePeriod(new Date('not-a-date'), new Date('2026-04-01'))).toThrow(
      'valid dates',
    );
  });
});
