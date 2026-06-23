/**
 * SUBP-006b — HUD-VASH voucher ↔ veteran match scoring (pure, DB-free).
 *
 * Produces a 0–100 score for how well an available voucher's unit fits a
 * veteran subject's housing profile, plus an explainable factor breakdown.
 * Kept pure so it can be unit-tested without a DB and reused by the query
 * layer and the detail view (the established subp factoring).
 *
 * Weights (sum 100): bedroom fit 50, accessibility 30, location proximity 20.
 * A missing subject constraint is treated as "no constraint" → full credit for
 * that factor, so an unprofiled subject isn't penalised.
 */

export interface VoucherMatchSubject {
  /** Bedrooms the household needs; null = unknown / no constraint. */
  bedroomNeed: number | null;
  /** True when the subject requires an accessible (e.g. wheelchair) unit. */
  accessibilityNeed: boolean;
  /** Subject's target 5-digit ZIP for proximity; null = unknown. */
  targetZip: string | null;
}

export interface VoucherMatchUnit {
  bedrooms: number;
  accessible: boolean;
  /** Unit 5-digit ZIP; null = unknown. */
  zip: string | null;
}

export interface VoucherMatchFactor {
  label: string;
  points: number;
  max: number;
  detail: string;
}

export interface VoucherMatchResult {
  /** 0–100, rounded. */
  score: number;
  factors: VoucherMatchFactor[];
}

const BEDROOM_MAX = 50;
const ACCESS_MAX = 30;
const ZIP_MAX = 20;

function scoreBedroom(need: number | null, unitBedrooms: number): VoucherMatchFactor {
  if (need == null) {
    return { label: 'Bedrooms', points: BEDROOM_MAX, max: BEDROOM_MAX, detail: 'no stated need' };
  }
  const diff = unitBedrooms - need;
  let points: number;
  let detail: string;
  if (diff === 0) {
    points = BEDROOM_MAX;
    detail = `exact fit (${unitBedrooms}br)`;
  } else if (diff > 0) {
    points = 35;
    detail = `${unitBedrooms}br for ${need}br need (oversized)`;
  } else if (diff === -1) {
    points = 15;
    detail = `${unitBedrooms}br for ${need}br need (one short)`;
  } else {
    points = 0;
    detail = `${unitBedrooms}br for ${need}br need (too small)`;
  }
  return { label: 'Bedrooms', points, max: BEDROOM_MAX, detail };
}

function scoreAccessibility(need: boolean, unitAccessible: boolean): VoucherMatchFactor {
  if (!need) {
    return { label: 'Accessibility', points: ACCESS_MAX, max: ACCESS_MAX, detail: 'no need' };
  }
  return unitAccessible
    ? { label: 'Accessibility', points: ACCESS_MAX, max: ACCESS_MAX, detail: 'accessible unit' }
    : { label: 'Accessibility', points: 0, max: ACCESS_MAX, detail: 'unit not accessible' };
}

function scoreZip(targetZip: string | null, unitZip: string | null): VoucherMatchFactor {
  if (!targetZip || !unitZip) {
    return { label: 'Location', points: 10, max: ZIP_MAX, detail: 'ZIP unknown' };
  }
  if (targetZip === unitZip) {
    return { label: 'Location', points: ZIP_MAX, max: ZIP_MAX, detail: 'same ZIP' };
  }
  if (targetZip.slice(0, 3) === unitZip.slice(0, 3)) {
    return { label: 'Location', points: 12, max: ZIP_MAX, detail: 'nearby (ZIP-3 match)' };
  }
  return { label: 'Location', points: 0, max: ZIP_MAX, detail: 'different area' };
}

export function scoreVoucherMatch(
  subject: VoucherMatchSubject,
  unit: VoucherMatchUnit,
): VoucherMatchResult {
  const factors = [
    scoreBedroom(subject.bedroomNeed, unit.bedrooms),
    scoreAccessibility(subject.accessibilityNeed, unit.accessible),
    scoreZip(subject.targetZip, unit.zip),
  ];
  const score = Math.round(factors.reduce((sum, f) => sum + f.points, 0));
  return { score, factors };
}
