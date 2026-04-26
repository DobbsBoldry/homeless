import { describe, expect, it } from 'vitest';
import type { EvictionFiling } from '@/db/schema/eviction-filings';
import { compareDocketRanking, type RankedDocketRow, rankDocketRows } from './docket-ranking';

const baseFiling = (overrides: Partial<EvictionFiling> = {}): EvictionFiling => ({
  id: '00000000-0000-0000-0000-000000000000',
  caseNumber: 'SYN-26-CI-00000',
  filedAt: new Date('2026-04-01T10:00:00-05:00'),
  courtDivision: '1st Division',
  plaintiff: 'Test LLC',
  defendantFirstName: 'D',
  defendantLastName: 'D',
  defendantAddress: null,
  causeType: 'non_payment',
  amountClaimedCents: 100_000,
  status: 'filed',
  source: 'synthetic',
  rawJson: null,
  dvFlag: false,
  createdAt: new Date(),
  updatedAt: new Date(),
  ...overrides,
});

const row = (
  id: string,
  filedAt: string,
  score: number | null,
  rationale: string | null = score == null ? null : 'because',
): RankedDocketRow => ({
  filing: baseFiling({ id, filedAt: new Date(filedAt) }),
  score,
  rationale,
});

describe('rankDocketRows', () => {
  it('sorts 3 scored + 1 unscored: highest score first, unscored last', () => {
    const a = row('a', '2026-04-10T10:00:00-05:00', 80);
    const b = row('b', '2026-04-12T10:00:00-05:00', 55);
    const c = row('c', '2026-04-08T10:00:00-05:00', 25);
    const d = row('d', '2026-04-20T10:00:00-05:00', null);

    const sorted = rankDocketRows([d, c, b, a]);
    expect(sorted.map((r) => r.filing.id)).toEqual(['a', 'b', 'c', 'd']);
  });

  it('breaks ties on score by filed_at DESC (newer first)', () => {
    const older = row('older', '2026-04-01T10:00:00-05:00', 50);
    const newer = row('newer', '2026-04-15T10:00:00-05:00', 50);

    const sorted = rankDocketRows([older, newer]);
    expect(sorted.map((r) => r.filing.id)).toEqual(['newer', 'older']);
  });

  it('two unscored filings still order by filed_at DESC among themselves', () => {
    const old = row('old', '2026-04-01T10:00:00-05:00', null);
    const fresh = row('fresh', '2026-04-20T10:00:00-05:00', null);

    const sorted = rankDocketRows([old, fresh]);
    expect(sorted.map((r) => r.filing.id)).toEqual(['fresh', 'old']);
  });

  it('does not mutate the input array', () => {
    const a = row('a', '2026-04-10T10:00:00-05:00', 90);
    const b = row('b', '2026-04-11T10:00:00-05:00', 10);
    const input = [b, a];
    rankDocketRows(input);
    expect(input.map((r) => r.filing.id)).toEqual(['b', 'a']);
  });

  it('treats null score identical to 0 for comparison', () => {
    const zero = row('zero', '2026-04-15T10:00:00-05:00', 0);
    const nullish = row('null', '2026-04-10T10:00:00-05:00', null);
    // both effectively-zero — newer filed_at wins
    expect(compareDocketRanking(zero, nullish)).toBeLessThan(0);
  });
});
