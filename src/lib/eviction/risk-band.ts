/**
 * Color/label band for a Claude-produced risk score (0-100).
 * Single source of truth so the case-detail panel and the daily-queue
 * table render the same bands consistently.
 *
 *   < 40  → lower risk (emerald)
 *  40-69  → moderate risk (amber)
 *   70+   → high risk (destructive/red)
 */
export const RISK_BAND_LOWER_MAX = 40;
export const RISK_BAND_HIGH_MIN = 70;

export function riskBandClass(score: number): string {
  if (score >= RISK_BAND_HIGH_MIN) return 'text-destructive';
  if (score >= RISK_BAND_LOWER_MAX) return 'text-amber-600 dark:text-amber-400';
  return 'text-emerald-600 dark:text-emerald-400';
}

export function riskBandLabel(score: number): string {
  if (score >= RISK_BAND_HIGH_MIN) return 'High risk';
  if (score >= RISK_BAND_LOWER_MAX) return 'Moderate risk';
  return 'Lower risk';
}
