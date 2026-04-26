/**
 * Triage tier recommendation (CWT-009). Rule-based v1; the BACKLOG
 * explicitly calls this out as a placeholder to be replaced by ML in
 * Phase 2 once enough labeled outcomes exist. The whole point right
 * now is consistency — give caseworkers a tier they can argue with,
 * not predict outcomes precisely.
 *
 * Output: tier ∈ {high, medium, low} reflecting "housing-stability
 * potential" (high = most likely to stabilize quickly with the right
 * supports; low = needs the most intensive intervention). Score is
 * 0-100; the tier bands are deliberately wide so a small input change
 * doesn't flip a tier.
 *
 * Every contribution is captured in `factors` so the caseworker UI
 * can show "this is high tier because: stable income source, prior
 * housing history, no recent evictions" — explainable by design.
 */

export type TriageInputs = {
  /** Stable income source (job, SSI, disability, retirement, etc.). */
  hasStableIncome: boolean;
  /** Active rental-assistance voucher in hand. */
  hasVoucher: boolean;
  /** Currently employed (any hours). */
  isEmployed: boolean;
  /** Existing relationship with a caseworker (current or recent). */
  hasCaseworkerRelationship: boolean;
  /** Currently engaged in substance-use treatment, if relevant. */
  inSudTreatment: boolean;
  /** Currently engaged in mental-health treatment, if relevant. */
  inMentalHealthTreatment: boolean;
  /** Number of evictions in the last 24 months (0 = none). */
  recentEvictionCount: number;
  /** Days unsheltered in the last 12 months (0 if always housed/sheltered). */
  daysUnsheltered: number;
  /** Children in household — adds urgency, not stability per se. */
  hasChildrenUnder18: boolean;
  /** Domestic-violence survivor — DTRS-004 abuser-blind handling already applies. */
  isDvSurvivor: boolean;
  /** Documents in hand: ID, SSN, birth certificate. Each ~5 stability points. */
  hasId: boolean;
  hasSsn: boolean;
  hasBirthCert: boolean;
};

export type TriageFactor = {
  /** Plain-language label shown in the UI. */
  label: string;
  /** +N raises stability tier; -N lowers. */
  delta: number;
};

export type TriageTier = 'high' | 'medium' | 'low';

export type TriageResult = {
  tier: TriageTier;
  /** 0-100 score; band thresholds are 33 / 67. */
  score: number;
  factors: TriageFactor[];
  /** When tier == 'low', a one-line "what to do next" suggestion. */
  recommendation: string;
};

const BASE_SCORE = 50;
const TIER_LOW_MAX = 32;
const TIER_HIGH_MIN = 67;

/**
 * Pure scorer. Each factor pushes the score up or down; the final
 * tier is just a banding of the clamped score. Deliberately small set
 * — broader feature space is what Phase 2's ML replacement is for.
 */
export function recommendTriageTier(inputs: TriageInputs): TriageResult {
  const factors: TriageFactor[] = [];

  if (inputs.hasStableIncome) factors.push({ label: 'Stable income source', delta: +12 });
  if (inputs.hasVoucher) factors.push({ label: 'Active rental-assistance voucher', delta: +18 });
  if (inputs.isEmployed) factors.push({ label: 'Currently employed', delta: +10 });
  if (inputs.hasCaseworkerRelationship)
    factors.push({ label: 'Existing caseworker relationship', delta: +6 });
  if (inputs.inSudTreatment) factors.push({ label: 'Engaged in SUD treatment', delta: +5 });
  if (inputs.inMentalHealthTreatment)
    factors.push({ label: 'Engaged in mental-health treatment', delta: +5 });

  if (inputs.recentEvictionCount === 1)
    factors.push({ label: '1 eviction in last 24 months', delta: -8 });
  else if (inputs.recentEvictionCount >= 2)
    factors.push({
      label: `${inputs.recentEvictionCount} evictions in last 24 months`,
      delta: -16,
    });

  if (inputs.daysUnsheltered >= 30 && inputs.daysUnsheltered < 90)
    factors.push({ label: '30-89 days unsheltered in last year', delta: -8 });
  else if (inputs.daysUnsheltered >= 90)
    factors.push({ label: '90+ days unsheltered in last year', delta: -16 });

  if (inputs.hasChildrenUnder18)
    factors.push({ label: 'Children under 18 in household — prioritize', delta: +4 });

  if (inputs.isDvSurvivor)
    factors.push({
      label: 'DV survivor — route through OASIS + abuser-blind handling',
      delta: +0,
    });

  // Documents in hand are small individual signals but additive.
  let docPoints = 0;
  if (inputs.hasId) docPoints += 4;
  if (inputs.hasSsn) docPoints += 4;
  if (inputs.hasBirthCert) docPoints += 3;
  if (docPoints > 0) {
    factors.push({ label: `Vital documents in hand (+${docPoints})`, delta: docPoints });
  }

  const raw = BASE_SCORE + factors.reduce((sum, f) => sum + f.delta, 0);
  const score = Math.max(0, Math.min(100, raw));

  let tier: TriageTier;
  if (score <= TIER_LOW_MAX) tier = 'low';
  else if (score >= TIER_HIGH_MIN) tier = 'high';
  else tier = 'medium';

  let recommendation: string;
  if (tier === 'high') {
    recommendation =
      'Likely stabilizes with light-touch support. Connect to KCHIP/SNAP/voucher renewal as needed; check in monthly.';
  } else if (tier === 'medium') {
    recommendation =
      'Moderate intensity. Pair with active caseworker; address top 1-2 documents/income gaps before placement.';
  } else {
    recommendation =
      'High intensity. Recommend Recuperative Care or PSH route (TEAMKY HRSN if eligible); wraparound case management.';
  }

  return { tier, score, factors, recommendation };
}
