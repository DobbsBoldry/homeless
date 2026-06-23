import { describe, expect, it } from 'vitest';
import { scoreVoucherMatch } from './voucher-match';

const unit = (over: Partial<Parameters<typeof scoreVoucherMatch>[1]> = {}) => ({
  bedrooms: 2,
  accessible: false,
  zip: '42301',
  ...over,
});
const subject = (over: Partial<Parameters<typeof scoreVoucherMatch>[0]> = {}) => ({
  bedroomNeed: 2 as number | null,
  accessibilityNeed: false,
  targetZip: '42301' as string | null,
  ...over,
});

describe('scoreVoucherMatch', () => {
  it('scores a perfect match at 100', () => {
    const r = scoreVoucherMatch(subject(), unit());
    expect(r.score).toBe(100);
  });

  it('gives full bedroom credit when subject has no stated need', () => {
    const r = scoreVoucherMatch(subject({ bedroomNeed: null }), unit());
    const bed = r.factors.find((f) => f.label === 'Bedrooms');
    expect(bed?.points).toBe(50);
  });

  it('penalises an undersized unit (one short → 15, too small → 0)', () => {
    const oneShort = scoreVoucherMatch(subject({ bedroomNeed: 3 }), unit({ bedrooms: 2 }));
    expect(oneShort.factors.find((f) => f.label === 'Bedrooms')?.points).toBe(15);
    const tooSmall = scoreVoucherMatch(subject({ bedroomNeed: 4 }), unit({ bedrooms: 2 }));
    expect(tooSmall.factors.find((f) => f.label === 'Bedrooms')?.points).toBe(0);
  });

  it('gives partial credit for an oversized unit', () => {
    const r = scoreVoucherMatch(subject({ bedroomNeed: 1 }), unit({ bedrooms: 2 }));
    expect(r.factors.find((f) => f.label === 'Bedrooms')?.points).toBe(35);
  });

  it('zeroes accessibility when needed but the unit is not accessible', () => {
    const r = scoreVoucherMatch(subject({ accessibilityNeed: true }), unit({ accessible: false }));
    expect(r.factors.find((f) => f.label === 'Accessibility')?.points).toBe(0);
  });

  it('credits accessibility when needed and the unit is accessible', () => {
    const r = scoreVoucherMatch(subject({ accessibilityNeed: true }), unit({ accessible: true }));
    expect(r.factors.find((f) => f.label === 'Accessibility')?.points).toBe(30);
  });

  it('gives full accessibility credit when there is no need', () => {
    const r = scoreVoucherMatch(subject({ accessibilityNeed: false }), unit({ accessible: false }));
    expect(r.factors.find((f) => f.label === 'Accessibility')?.points).toBe(30);
  });

  it('scores location: same ZIP=20, ZIP-3 match=12, different=0, unknown=10', () => {
    expect(
      scoreVoucherMatch(subject({ targetZip: '42301' }), unit({ zip: '42301' })).factors.find(
        (f) => f.label === 'Location',
      )?.points,
    ).toBe(20);
    expect(
      scoreVoucherMatch(subject({ targetZip: '42301' }), unit({ zip: '42303' })).factors.find(
        (f) => f.label === 'Location',
      )?.points,
    ).toBe(12);
    expect(
      scoreVoucherMatch(subject({ targetZip: '42301' }), unit({ zip: '40001' })).factors.find(
        (f) => f.label === 'Location',
      )?.points,
    ).toBe(0);
    expect(
      scoreVoucherMatch(subject({ targetZip: null }), unit({ zip: '42301' })).factors.find(
        (f) => f.label === 'Location',
      )?.points,
    ).toBe(10);
  });

  it('never exceeds 100 or drops below 0', () => {
    const worst = scoreVoucherMatch(
      subject({ bedroomNeed: 4, accessibilityNeed: true, targetZip: '42301' }),
      unit({ bedrooms: 1, accessible: false, zip: '99999' }),
    );
    expect(worst.score).toBeGreaterThanOrEqual(0);
    expect(worst.score).toBeLessThanOrEqual(100);
  });
});
