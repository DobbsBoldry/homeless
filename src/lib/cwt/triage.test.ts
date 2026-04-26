import { describe, expect, it } from 'vitest';
import { recommendTriageTier, type TriageInputs } from './triage';

const baseInputs = (overrides: Partial<TriageInputs> = {}): TriageInputs => ({
  hasStableIncome: false,
  hasVoucher: false,
  isEmployed: false,
  hasCaseworkerRelationship: false,
  inSudTreatment: false,
  inMentalHealthTreatment: false,
  recentEvictionCount: 0,
  daysUnsheltered: 0,
  hasChildrenUnder18: false,
  isDvSurvivor: false,
  hasId: false,
  hasSsn: false,
  hasBirthCert: false,
  ...overrides,
});

describe('recommendTriageTier', () => {
  it('returns medium tier for the empty/baseline case (score 50)', () => {
    const r = recommendTriageTier(baseInputs());
    expect(r.tier).toBe('medium');
    expect(r.score).toBe(50);
    expect(r.factors).toEqual([]);
  });

  it('high tier for stable income + voucher + employed', () => {
    const r = recommendTriageTier(
      baseInputs({ hasStableIncome: true, hasVoucher: true, isEmployed: true }),
    );
    expect(r.tier).toBe('high');
    expect(r.score).toBeGreaterThanOrEqual(67);
  });

  it('low tier for severe instability', () => {
    const r = recommendTriageTier(baseInputs({ recentEvictionCount: 3, daysUnsheltered: 120 }));
    expect(r.tier).toBe('low');
    expect(r.score).toBeLessThanOrEqual(32);
  });

  it('clamps score to [0, 100]', () => {
    const veryHigh = recommendTriageTier(
      baseInputs({
        hasStableIncome: true,
        hasVoucher: true,
        isEmployed: true,
        hasCaseworkerRelationship: true,
        inSudTreatment: true,
        inMentalHealthTreatment: true,
        hasId: true,
        hasSsn: true,
        hasBirthCert: true,
      }),
    );
    expect(veryHigh.score).toBeLessThanOrEqual(100);
    expect(veryHigh.tier).toBe('high');

    const veryLow = recommendTriageTier(
      baseInputs({ recentEvictionCount: 5, daysUnsheltered: 365 }),
    );
    expect(veryLow.score).toBeGreaterThanOrEqual(0);
    expect(veryLow.tier).toBe('low');
  });

  it('records each factor that fires, with non-zero delta', () => {
    const r = recommendTriageTier(baseInputs({ hasStableIncome: true, recentEvictionCount: 2 }));
    const labels = r.factors.map((f) => f.label);
    expect(labels).toContain('Stable income source');
    expect(labels.some((l) => l.startsWith('2 evictions'))).toBe(true);
  });

  it('children + DV are surfaced as factors but DV is delta=0 (handling-routing only)', () => {
    const r = recommendTriageTier(baseInputs({ hasChildrenUnder18: true, isDvSurvivor: true }));
    const dv = r.factors.find((f) => f.label.includes('DV survivor'));
    expect(dv?.delta).toBe(0);
    const kids = r.factors.find((f) => f.label.includes('Children under 18'));
    expect(kids?.delta).toBeGreaterThan(0);
  });

  it('returns a tier-appropriate recommendation', () => {
    const high = recommendTriageTier(baseInputs({ hasVoucher: true, hasStableIncome: true }));
    expect(high.recommendation).toMatch(/light-touch/);
    const low = recommendTriageTier(baseInputs({ recentEvictionCount: 3, daysUnsheltered: 120 }));
    expect(low.recommendation).toMatch(/Recuperative Care|PSH/);
  });
});
