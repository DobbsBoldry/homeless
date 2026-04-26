import { describe, expect, it } from 'vitest';
import {
  fplMonthlyCents,
  fplPercent,
  type Household,
  screenHousehold,
  totalLikelyMonthlyCents,
} from './benefits';

const baseHousehold = (overrides: Partial<Household> = {}): Household => ({
  monthlyIncomeCents: 100_000, // $1,000 / mo
  householdSize: 1,
  hasChildrenUnder18: false,
  hasPregnantMember: false,
  isVeteran: false,
  isDisabled: false,
  ageOldest: 35,
  kyResident: true,
  citizenOrQualified: true,
  ...overrides,
});

const findById = (results: ReturnType<typeof screenHousehold>, id: string) =>
  results.find((r) => r.programId === id);

describe('fplMonthlyCents', () => {
  it('matches the 2024 HHS table for sizes 1-8', () => {
    expect(fplMonthlyCents(1)).toBe(125_400);
    expect(fplMonthlyCents(4)).toBe(257_400);
    expect(fplMonthlyCents(8)).toBe(433_400);
  });

  it('extrapolates linearly above 8', () => {
    expect(fplMonthlyCents(10)).toBe(433_400 + 2 * 44_000);
  });

  it('clamps non-positive household size to 1', () => {
    expect(fplMonthlyCents(0)).toBe(125_400);
  });
});

describe('fplPercent', () => {
  it('returns income as percent of FPL with one decimal', () => {
    // Single household, $1254/mo = 100% FPL.
    expect(fplPercent(125_400, 1)).toBe(100);
    // $627/mo single = 50%.
    expect(fplPercent(62_700, 1)).toBe(50);
  });
});

describe('screenHousehold — SNAP', () => {
  it('marks SNAP likely for low-income KY resident citizen', () => {
    const r = findById(screenHousehold(baseHousehold()), 'snap');
    expect(r?.status).toBe('likely');
    expect(r?.estimatedMonthlyCents).toBeGreaterThan(0);
  });

  it('marks SNAP ineligible above 130% FPL', () => {
    const r = findById(screenHousehold(baseHousehold({ monthlyIncomeCents: 200_000 })), 'snap');
    expect(r?.status).toBe('ineligible');
  });

  it('marks SNAP ineligible for non-KY resident', () => {
    const r = findById(screenHousehold(baseHousehold({ kyResident: false })), 'snap');
    expect(r?.status).toBe('ineligible');
  });

  it('marks SNAP maybe when citizenship is unclear', () => {
    const r = findById(screenHousehold(baseHousehold({ citizenOrQualified: false })), 'snap');
    expect(r?.status).toBe('maybe');
  });
});

describe('screenHousehold — KCHIP', () => {
  it('likely for kid-having low-income KY family', () => {
    const r = findById(
      screenHousehold(
        baseHousehold({
          householdSize: 4,
          hasChildrenUnder18: true,
          monthlyIncomeCents: 250_000,
        }),
      ),
      'kchip',
    );
    expect(r?.status).toBe('likely');
  });

  it('ineligible without a child or pregnancy', () => {
    const r = findById(screenHousehold(baseHousehold()), 'kchip');
    expect(r?.status).toBe('ineligible');
    expect(r?.reason).toMatch(/under 18/);
  });
});

describe('screenHousehold — KTAP', () => {
  it('likely for very-low-income family with kids', () => {
    const r = findById(
      screenHousehold(
        baseHousehold({
          householdSize: 3,
          hasChildrenUnder18: true,
          monthlyIncomeCents: 30_000, // $300 / mo
        }),
      ),
      'ktap',
    );
    expect(r?.status).toBe('likely');
    expect(r?.estimatedMonthlyCents).toBeGreaterThan(0);
  });

  it('maybe when income is borderline', () => {
    const r = findById(
      screenHousehold(
        baseHousehold({
          householdSize: 3,
          hasChildrenUnder18: true,
          monthlyIncomeCents: 80_000,
        }),
      ),
      'ktap',
    );
    expect(r?.status).toBe('maybe');
  });

  it('ineligible without a child', () => {
    const r = findById(screenHousehold(baseHousehold()), 'ktap');
    expect(r?.status).toBe('ineligible');
  });
});

describe('screenHousehold — SSI', () => {
  it('likely for an aged or disabled household member with low income', () => {
    const r = findById(
      screenHousehold(baseHousehold({ ageOldest: 70, monthlyIncomeCents: 30_000 })),
      'ssi',
    );
    expect(r?.status).toBe('likely');
  });

  it('ineligible for under-65 non-disabled', () => {
    const r = findById(screenHousehold(baseHousehold({ ageOldest: 35 })), 'ssi');
    expect(r?.status).toBe('ineligible');
  });

  it('maybe when income near or above SSI FBR', () => {
    const r = findById(
      screenHousehold(baseHousehold({ isDisabled: true, monthlyIncomeCents: 100_000 })),
      'ssi',
    );
    expect(r?.status).toBe('maybe');
  });
});

describe('screenHousehold — VA', () => {
  it('marks VA maybe for any veteran', () => {
    const r = findById(screenHousehold(baseHousehold({ isVeteran: true })), 'va_pension');
    expect(r?.status).toBe('maybe');
  });

  it('ineligible for non-veteran', () => {
    const r = findById(screenHousehold(baseHousehold()), 'va_pension');
    expect(r?.status).toBe('ineligible');
  });
});

describe('screenHousehold — LIHEAP', () => {
  it('likely for KY resident under 130% FPL', () => {
    const r = findById(screenHousehold(baseHousehold()), 'liheap');
    expect(r?.status).toBe('likely');
  });

  it('ineligible above 130% FPL', () => {
    const r = findById(screenHousehold(baseHousehold({ monthlyIncomeCents: 200_000 })), 'liheap');
    expect(r?.status).toBe('ineligible');
  });
});

describe('screenHousehold — sort order', () => {
  it('puts likely first, maybe next, ineligible last', () => {
    const results = screenHousehold(
      baseHousehold({
        householdSize: 4,
        hasChildrenUnder18: true,
        monthlyIncomeCents: 100_000,
      }),
    );
    let phase = 0;
    for (const r of results) {
      const next = r.status === 'likely' ? 0 : r.status === 'maybe' ? 1 : 2;
      expect(next).toBeGreaterThanOrEqual(phase);
      phase = next;
    }
  });
});

describe('totalLikelyMonthlyCents', () => {
  it('sums only likely matches with estimates', () => {
    const results = screenHousehold(
      baseHousehold({
        householdSize: 3,
        hasChildrenUnder18: true,
        monthlyIncomeCents: 30_000,
      }),
    );
    expect(totalLikelyMonthlyCents(results)).toBeGreaterThan(0);
  });

  it('returns 0 when no estimates', () => {
    expect(totalLikelyMonthlyCents([])).toBe(0);
  });
});
