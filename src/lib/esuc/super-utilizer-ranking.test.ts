import { describe, expect, it } from 'vitest';
import {
  HOUSING_INSTABILITY_FLAGS,
  isHousingUnstable,
  rankSuperUtilizers,
  type SuperUtilizerRow,
} from './super-utilizer-ranking';

const row = (
  patientId: string,
  visitCount: number,
  latestVisitAt: string,
  housingStatus: SuperUtilizerRow['housingStatus'] = 'shelter',
): SuperUtilizerRow => ({
  patientId,
  visitCount,
  latestVisitAt: new Date(latestVisitAt),
  housingStatus,
  lastChiefComplaint: 'chest pain',
});

describe('rankSuperUtilizers', () => {
  it('orders by visit_count DESC, then latest_visit_at DESC', () => {
    const a = row('a', 5, '2026-04-20T10:00:00-05:00');
    const b = row('b', 3, '2026-04-22T10:00:00-05:00');
    const c = row('c', 7, '2026-04-15T10:00:00-05:00');
    const sorted = rankSuperUtilizers([a, b, c]);
    expect(sorted.map((r) => r.patientId)).toEqual(['c', 'a', 'b']);
  });

  it('breaks visit-count ties by latest_visit_at DESC (newer first)', () => {
    const older = row('older', 4, '2026-04-01T10:00:00-05:00');
    const newer = row('newer', 4, '2026-04-25T10:00:00-05:00');
    const sorted = rankSuperUtilizers([older, newer]);
    expect(sorted.map((r) => r.patientId)).toEqual(['newer', 'older']);
  });

  it('does not mutate the input array', () => {
    const a = row('a', 3, '2026-04-10T10:00:00-05:00');
    const b = row('b', 5, '2026-04-11T10:00:00-05:00');
    const input = [a, b];
    rankSuperUtilizers(input);
    expect(input.map((r) => r.patientId)).toEqual(['a', 'b']);
  });

  it('returns [] for empty input', () => {
    expect(rankSuperUtilizers([])).toEqual([]);
  });
});

describe('isHousingUnstable / HOUSING_INSTABILITY_FLAGS', () => {
  it('flags shelter / unsheltered / doubled_up', () => {
    expect(isHousingUnstable('shelter')).toBe(true);
    expect(isHousingUnstable('unsheltered')).toBe(true);
    expect(isHousingUnstable('doubled_up')).toBe(true);
  });
  it('does NOT flag housed or unknown', () => {
    expect(isHousingUnstable('housed')).toBe(false);
    expect(isHousingUnstable('unknown')).toBe(false);
  });
  it('flag set has exactly 3 members', () => {
    expect(HOUSING_INSTABILITY_FLAGS.size).toBe(3);
  });
});
