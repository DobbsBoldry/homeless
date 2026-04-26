import { describe, expect, it } from 'vitest';
import { listLastNQuarters, quarterFromDate } from './public-outcomes';

describe('quarterFromDate', () => {
  it('Q1 covers Jan–Mar', () => {
    expect(quarterFromDate(new Date('2026-01-15T12:00:00Z'))).toEqual({
      year: 2026,
      quarter: 1,
      label: '2026 Q1',
    });
    expect(quarterFromDate(new Date('2026-03-31T23:00:00Z'))).toEqual({
      year: 2026,
      quarter: 1,
      label: '2026 Q1',
    });
  });

  it('Q4 covers Oct–Dec', () => {
    expect(quarterFromDate(new Date('2026-10-01T00:00:00Z'))).toEqual({
      year: 2026,
      quarter: 4,
      label: '2026 Q4',
    });
    expect(quarterFromDate(new Date('2026-12-31T23:00:00Z'))).toEqual({
      year: 2026,
      quarter: 4,
      label: '2026 Q4',
    });
  });
});

describe('listLastNQuarters', () => {
  it('returns N quarters ending with the current one, oldest first', () => {
    const out = listLastNQuarters(new Date('2026-04-26T12:00:00Z'), 4);
    expect(out.map((q) => q.label)).toEqual(['2025 Q3', '2025 Q4', '2026 Q1', '2026 Q2']);
  });

  it('rolls over the year boundary correctly', () => {
    const out = listLastNQuarters(new Date('2026-02-15T12:00:00Z'), 5);
    expect(out.map((q) => q.label)).toEqual([
      '2025 Q1',
      '2025 Q2',
      '2025 Q3',
      '2025 Q4',
      '2026 Q1',
    ]);
  });

  it('N=1 returns just the current quarter', () => {
    const out = listLastNQuarters(new Date('2026-04-26T12:00:00Z'), 1);
    expect(out.map((q) => q.label)).toEqual(['2026 Q2']);
  });
});
