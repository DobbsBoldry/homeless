/**
 * Benefits eligibility rule engine (CWT-007) + dollar-value estimator
 * (CWT-008). KY-specific income thresholds. Static rules first; the
 * vocabulary is intentionally narrow because every program has dozens
 * of edge cases the legal team will refine over Phase 2.
 *
 * Every rule output is marked `[SAMPLE]` in copy until a verification
 * pass against current KY DCBS / KHC / SSA documentation lands. The
 * caseworker UI surfaces this prominently so no one acts on a number
 * before it's been reviewed.
 *
 * Federal Poverty Level numbers are 2024 (HHS) — the working set we
 * have access to today. Bump these when 2025/2026 numbers publish.
 */

/** Monthly income, in CENTS, that equals 100% of FPL by household size. */
export const FPL_2024_MONTHLY_CENTS: Record<number, number> = {
  1: 125_400, // $1,254 / mo
  2: 169_400,
  3: 213_400,
  4: 257_400,
  5: 301_400,
  6: 345_400,
  7: 389_400,
  8: 433_400,
};

/** Each additional household member above 8. */
const FPL_2024_PER_ADDL_CENTS = 44_000;

export function fplMonthlyCents(householdSize: number): number {
  if (householdSize <= 0) return FPL_2024_MONTHLY_CENTS[1];
  if (householdSize <= 8) return FPL_2024_MONTHLY_CENTS[householdSize];
  const over = householdSize - 8;
  return FPL_2024_MONTHLY_CENTS[8] + over * FPL_2024_PER_ADDL_CENTS;
}

export function fplPercent(monthlyIncomeCents: number, householdSize: number): number {
  const baseline = fplMonthlyCents(householdSize);
  if (baseline <= 0) return 0;
  return Math.round((monthlyIncomeCents / baseline) * 1000) / 10; // one decimal place
}

export type Household = {
  monthlyIncomeCents: number;
  householdSize: number;
  hasChildrenUnder18: boolean;
  hasPregnantMember: boolean;
  isVeteran: boolean;
  isDisabled: boolean;
  /** Age of the oldest household member; affects SSI / Medicare paths. */
  ageOldest?: number | null;
  kyResident: boolean;
  /** US citizen or qualified non-citizen. SNAP / KCHIP gate this. */
  citizenOrQualified: boolean;
};

export type ProgramId =
  | 'snap'
  | 'kchip'
  | 'medicaid_adult'
  | 'ktap'
  | 'ssi'
  | 'va_pension'
  | 'liheap';

export type EligibilityMatch = {
  programId: ProgramId;
  programName: string;
  /** "likely" / "maybe" / "ineligible". Maybe = caseworker should verify. */
  status: 'likely' | 'maybe' | 'ineligible';
  /** 1-2 sentences of plain-language reasoning. */
  reason: string;
  /** Estimated monthly dollar value (cents). null when not estimable. */
  estimatedMonthlyCents: number | null;
  /** How to apply — phone number / website / in-person path. */
  applicationPath: string;
  /** Display order priority; lower = surfaced first. */
  priority: number;
};

/** SNAP gross-income test: 130% FPL for most households. */
function evaluateSnap(h: Household): EligibilityMatch {
  const fplPct = fplPercent(h.monthlyIncomeCents, h.householdSize);
  if (!h.kyResident) {
    return mk('snap', 'SNAP food benefits', 'ineligible', 'Must be a Kentucky resident.', null, 5);
  }
  if (!h.citizenOrQualified) {
    return mk(
      'snap',
      'SNAP food benefits',
      'maybe',
      'Citizenship rules limit SNAP. Some non-citizens still qualify (refugees, lawful permanent residents past 5 years, others). Caseworker should verify.',
      null,
      5,
    );
  }
  if (fplPct <= 130) {
    // SNAP formula (rough): benefit = max − 0.3 × (gross − standard deduction).
    // 2024 standard deduction for HH ≤ 3 is $198/mo, scaling up. We use a
    // flat $200 to keep the estimator readable; actuals are off by a few
    // dollars and the screener marks every output [SAMPLE] anyway.
    const STD_DEDUCTION_CENTS = 20_000;
    const max = snapMaxMonthlyCents(h.householdSize);
    const net = Math.max(0, h.monthlyIncomeCents - STD_DEDUCTION_CENTS);
    const estimate = Math.max(0, Math.round(max - net * 0.3));
    return mk(
      'snap',
      'SNAP food benefits',
      'likely',
      `Income is ${fplPct}% of poverty line — under the 130% gross-income limit for SNAP.`,
      Math.min(max, estimate),
      1,
    );
  }
  return mk(
    'snap',
    'SNAP food benefits',
    'ineligible',
    `Gross income (${fplPct}% FPL) exceeds the 130% SNAP gross-income limit.`,
    null,
    5,
  );
}

/** Max SNAP allotment by household size (FY2024 CONUS). */
function snapMaxMonthlyCents(householdSize: number): number {
  const TABLE: Record<number, number> = {
    1: 29_100,
    2: 53_500,
    3: 76_600,
    4: 97_300,
    5: 115_500,
    6: 138_600,
    7: 153_200,
    8: 175_100,
  };
  if (householdSize <= 0) return TABLE[1];
  if (householdSize <= 8) return TABLE[householdSize];
  return TABLE[8] + (householdSize - 8) * 21_900;
}

/** KCHIP: KY children's Medicaid, up to 218% FPL. */
function evaluateKchip(h: Household): EligibilityMatch {
  if (!h.kyResident) {
    return mk('kchip', 'KCHIP children\u2019s Medicaid', 'ineligible', 'KY-only program.', null, 7);
  }
  if (!h.hasChildrenUnder18 && !h.hasPregnantMember) {
    return mk(
      'kchip',
      'KCHIP children\u2019s Medicaid',
      'ineligible',
      'KCHIP covers children under 18 (and pregnant household members). No qualifying member listed.',
      null,
      7,
    );
  }
  const fplPct = fplPercent(h.monthlyIncomeCents, h.householdSize);
  if (fplPct <= 218) {
    return mk(
      'kchip',
      'KCHIP children\u2019s Medicaid',
      'likely',
      `Income (${fplPct}% FPL) is within the 218% threshold for KCHIP.`,
      null,
      2,
    );
  }
  return mk(
    'kchip',
    'KCHIP children\u2019s Medicaid',
    'ineligible',
    `Income (${fplPct}% FPL) exceeds the 218% KCHIP threshold.`,
    null,
    7,
  );
}

/** Adult Medicaid expansion (KY): up to 138% FPL. */
function evaluateMedicaidAdult(h: Household): EligibilityMatch {
  if (!h.kyResident) {
    return mk('medicaid_adult', 'KY Medicaid (adult)', 'ineligible', 'KY-only program.', null, 8);
  }
  const fplPct = fplPercent(h.monthlyIncomeCents, h.householdSize);
  if (fplPct <= 138) {
    return mk(
      'medicaid_adult',
      'KY Medicaid (adult expansion)',
      'likely',
      `Income (${fplPct}% FPL) is within the 138% threshold for adult Medicaid.`,
      null,
      3,
    );
  }
  return mk(
    'medicaid_adult',
    'KY Medicaid (adult expansion)',
    'ineligible',
    `Income (${fplPct}% FPL) exceeds the 138% adult Medicaid threshold.`,
    null,
    8,
  );
}

/** KTAP — KY's TANF: families with children, ~30% FPL after disregards. */
function evaluateKtap(h: Household): EligibilityMatch {
  if (!h.kyResident) return mk('ktap', 'KTAP cash assistance', 'ineligible', 'KY-only.', null, 9);
  if (!h.hasChildrenUnder18) {
    return mk(
      'ktap',
      'KTAP cash assistance',
      'ineligible',
      'KTAP requires a dependent child in the household.',
      null,
      9,
    );
  }
  const fplPct = fplPercent(h.monthlyIncomeCents, h.householdSize);
  if (fplPct <= 30) {
    // Rough KTAP base: $186/mo for 1, $234 for 2, $292 for 3 — rounded.
    const base = ktapMonthlyCents(h.householdSize);
    return mk(
      'ktap',
      'KTAP cash assistance',
      'likely',
      `Income (${fplPct}% FPL) is well below KTAP's working threshold.`,
      base,
      4,
    );
  }
  if (fplPct <= 50) {
    return mk(
      'ktap',
      'KTAP cash assistance',
      'maybe',
      `Income (${fplPct}% FPL) is borderline. Disregards (childcare, work expenses) may bring it under the limit.`,
      null,
      4,
    );
  }
  return mk(
    'ktap',
    'KTAP cash assistance',
    'ineligible',
    `Income (${fplPct}% FPL) exceeds KTAP's threshold even with typical disregards.`,
    null,
    9,
  );
}

function ktapMonthlyCents(householdSize: number): number {
  const TABLE: Record<number, number> = {
    1: 18_600,
    2: 23_400,
    3: 29_200,
    4: 35_900,
    5: 41_500,
    6: 47_000,
    7: 52_600,
    8: 58_100,
  };
  if (householdSize <= 0) return TABLE[1];
  if (householdSize <= 8) return TABLE[householdSize];
  return TABLE[8] + (householdSize - 8) * 5_500;
}

function evaluateSsi(h: Household): EligibilityMatch {
  const ageBased = (h.ageOldest ?? 0) >= 65;
  if (!h.isDisabled && !ageBased) {
    return mk(
      'ssi',
      'SSI (Supplemental Security Income)',
      'ineligible',
      'SSI requires either a qualifying disability OR age 65+.',
      null,
      10,
    );
  }
  // 2024 SSI federal benefit rate: $943/mo individual.
  const SSI_FBR_INDIVIDUAL_CENTS = 94_300;
  if (h.monthlyIncomeCents >= SSI_FBR_INDIVIDUAL_CENTS) {
    return mk(
      'ssi',
      'SSI (Supplemental Security Income)',
      'maybe',
      'Income is near or above the SSI federal benefit rate. SSA still applies disregards (first $20 + first $65 of earned income); a caseworker should verify.',
      null,
      6,
    );
  }
  // Estimate: FBR minus countable income (rough — SSA disregards $20 unearned + $65 earned + ½ remainder).
  const countable = Math.max(0, h.monthlyIncomeCents - 2_000);
  const estimate = Math.max(0, SSI_FBR_INDIVIDUAL_CENTS - countable);
  return mk(
    'ssi',
    'SSI (Supplemental Security Income)',
    'likely',
    ageBased ? 'Age 65+ and income below SSI cap.' : 'Disability + income below SSI cap.',
    estimate,
    5,
  );
}

function evaluateVa(h: Household): EligibilityMatch {
  if (!h.isVeteran) {
    return mk(
      'va_pension',
      'VA pension / benefits',
      'ineligible',
      'VA benefits require veteran status.',
      null,
      11,
    );
  }
  return mk(
    'va_pension',
    'VA pension / benefits',
    'maybe',
    'Several veterans benefits apply (HUD-VASH housing voucher, VA pension, healthcare). Eligibility depends on service period and income; a Veterans Service Officer review is the right next step.',
    null,
    6,
  );
}

function evaluateLiheap(h: Household): EligibilityMatch {
  if (!h.kyResident) {
    return mk('liheap', 'LIHEAP utility assistance', 'ineligible', 'KY-only.', null, 12);
  }
  // KY LIHEAP threshold: 130% FPL (winter / summer programs vary slightly).
  const fplPct = fplPercent(h.monthlyIncomeCents, h.householdSize);
  if (fplPct <= 130) {
    return mk(
      'liheap',
      'LIHEAP utility assistance',
      'likely',
      `Income (${fplPct}% FPL) is within KY LIHEAP's 130% threshold.`,
      null,
      3,
    );
  }
  return mk(
    'liheap',
    'LIHEAP utility assistance',
    'ineligible',
    `Income (${fplPct}% FPL) exceeds the 130% LIHEAP threshold.`,
    null,
    11,
  );
}

const APPLICATION_PATHS: Record<ProgramId, string> = {
  snap: 'Apply at benefind.ky.gov or call DCBS at +1-855-306-8959.',
  kchip: 'Apply at kynect.ky.gov or call +1-855-459-6328.',
  medicaid_adult: 'Apply at kynect.ky.gov or call +1-855-459-6328.',
  ktap: 'Apply at benefind.ky.gov or your local DCBS office.',
  ssi: 'Apply at ssa.gov/benefits/ssi or call +1-800-772-1213.',
  va_pension: 'Contact a KY Department of Veterans Affairs benefits counselor at +1-502-595-4447.',
  liheap: 'Apply through Audubon Area Community Services at +1-270-686-1600 (Daviess County).',
};

const PROGRAM_NAMES: Record<ProgramId, string> = {
  snap: 'SNAP food benefits',
  kchip: 'KCHIP children\u2019s Medicaid',
  medicaid_adult: 'KY Medicaid (adult expansion)',
  ktap: 'KTAP cash assistance',
  ssi: 'SSI (Supplemental Security Income)',
  va_pension: 'VA pension / benefits',
  liheap: 'LIHEAP utility assistance',
};

function mk(
  id: ProgramId,
  _displayName: string,
  status: EligibilityMatch['status'],
  reason: string,
  estimatedMonthlyCents: number | null,
  priority: number,
): EligibilityMatch {
  return {
    programId: id,
    programName: PROGRAM_NAMES[id],
    status,
    reason,
    estimatedMonthlyCents,
    applicationPath: APPLICATION_PATHS[id],
    priority,
  };
}

/**
 * Run every program rule against the household. Results are sorted with
 * 'likely' first, 'maybe' next, ineligible last; ties broken by `priority`.
 */
export function screenHousehold(h: Household): EligibilityMatch[] {
  const results = [
    evaluateSnap(h),
    evaluateKchip(h),
    evaluateMedicaidAdult(h),
    evaluateKtap(h),
    evaluateSsi(h),
    evaluateVa(h),
    evaluateLiheap(h),
  ];
  const statusRank: Record<EligibilityMatch['status'], number> = {
    likely: 0,
    maybe: 1,
    ineligible: 2,
  };
  results.sort((a, b) => {
    if (statusRank[a.status] !== statusRank[b.status]) {
      return statusRank[a.status] - statusRank[b.status];
    }
    return a.priority - b.priority;
  });
  return results;
}

/** Total estimated monthly $ across all 'likely' matches. */
export function totalLikelyMonthlyCents(matches: EligibilityMatch[]): number {
  return matches
    .filter((m) => m.status === 'likely' && m.estimatedMonthlyCents !== null)
    .reduce((sum, m) => sum + (m.estimatedMonthlyCents ?? 0), 0);
}
