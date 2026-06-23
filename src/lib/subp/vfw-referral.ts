/**
 * SUBP-006c — VFW Owensboro referral packet builder + voucher-stage rollup.
 *
 * Pure, DB-free helpers (the established subp factoring) so they're unit-
 * testable and reusable by the query layer, the server action, and the
 * printable packet route. No PHI: synthetic subject data only until BAA close.
 */

/** Fixed referral recipient for the veteran pathway (single local post). */
export const VFW_OWENSBORO_RECIPIENT = 'VFW Post — Owensboro, KY';

/**
 * Per-subject voucher pipeline stage. `not_applied` is the derived default;
 * the rest mirror the `veteran_voucher_application_status` lifecycle (minus
 * `withdrawn`, which rolls back to `not_applied`).
 */
export type VeteranVoucherStage = 'not_applied' | 'applied' | 'pending' | 'approved' | 'housed';

/** Ordering for "furthest stage wins" rollup + display. */
export const VETERAN_VOUCHER_STAGE_ORDER: VeteranVoucherStage[] = [
  'not_applied',
  'applied',
  'pending',
  'approved',
  'housed',
];

export const VETERAN_VOUCHER_STAGE_LABELS: Record<VeteranVoucherStage, string> = {
  not_applied: 'Not applied',
  applied: 'Applied',
  pending: 'Pending',
  approved: 'Approved',
  housed: 'Housed',
};

/** Application-status values that map onto a pipeline stage. */
type ApplicationStatusish = { status: string };

function stageForStatus(status: string): VeteranVoucherStage {
  switch (status) {
    case 'applied':
    case 'pending':
    case 'approved':
    case 'housed':
      return status;
    default:
      // 'withdrawn' or anything unknown → not in the active pipeline.
      return 'not_applied';
  }
}

/**
 * Roll a subject's voucher applications up to a single pipeline stage: the
 * furthest any application has reached. No applications (or only withdrawn
 * ones) → `not_applied`.
 */
export function deriveVeteranVoucherStage(
  applications: ApplicationStatusish[],
): VeteranVoucherStage {
  let best: VeteranVoucherStage = 'not_applied';
  let bestRank = 0;
  for (const app of applications) {
    const stage = stageForStatus(app.status);
    const rank = VETERAN_VOUCHER_STAGE_ORDER.indexOf(stage);
    if (rank > bestRank) {
      bestRank = rank;
      best = stage;
    }
  }
  return best;
}

export interface ReferralVeteranInput {
  legalFirstName: string;
  legalLastName: string;
  syntheticPersonRef: string;
  branchOfService: string | null;
  eligibilitySource: 'va_confirmed' | 'self_reported';
  caseworkerVerified: boolean;
  bedroomNeed: number | null;
  accessibilityNeed: boolean;
  targetZip: string | null;
}

export interface ReferralMatchInput {
  voucherCode: string;
  unitType: string;
  bedrooms: number;
  location: string;
  zip: string | null;
  score: number;
  applied: boolean;
  stage: VeteranVoucherStage;
}

export interface BuildPacketInput {
  veteran: ReferralVeteranInput;
  caseworkerName: string | null;
  matches: ReferralMatchInput[];
  eligibilitySummary: string;
}

export interface VfwReferralPacket {
  recipient: string;
  subject: {
    fullName: string;
    personRef: string;
    branchOfService: string;
    housingProfile: string;
  };
  contact: { caseworkerName: string };
  eligibilitySummary: string;
  matchedVouchers: ReferralMatchInput[];
}

function describeHousingProfile(v: ReferralVeteranInput): string {
  const parts: string[] = [];
  parts.push(v.bedroomNeed == null ? 'bedrooms: no stated need' : `${v.bedroomNeed} bedroom need`);
  parts.push(v.accessibilityNeed ? 'requires accessible unit' : 'no accessibility need');
  parts.push(v.targetZip ? `target ZIP ${v.targetZip}` : 'target ZIP: unknown');
  return parts.join(' · ');
}

/**
 * Assemble a referral packet ready for caseworker review and printing. The
 * matched vouchers are sorted highest-score-first so the strongest options
 * lead. A snapshot of this object is persisted with the referral event.
 */
export function buildVfwReferralPacket(input: BuildPacketInput): VfwReferralPacket {
  const { veteran, caseworkerName, matches, eligibilitySummary } = input;
  const matchedVouchers = [...matches].sort((a, b) => b.score - a.score);
  return {
    recipient: VFW_OWENSBORO_RECIPIENT,
    subject: {
      fullName: `${veteran.legalFirstName} ${veteran.legalLastName}`,
      personRef: veteran.syntheticPersonRef,
      branchOfService: veteran.branchOfService ?? 'Branch unknown',
      housingProfile: describeHousingProfile(veteran),
    },
    contact: { caseworkerName: caseworkerName ?? 'Unassigned' },
    eligibilitySummary,
    matchedVouchers,
  };
}
