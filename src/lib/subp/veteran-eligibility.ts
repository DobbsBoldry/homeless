/**
 * SUBP-006a — veteran-eligibility rule (pure, DB-free).
 *
 * Single source of truth for "is this subject veteran-eligible?":
 *   eligible = VA-documentation-confirmed OR (self-reported AND caseworker-verified)
 *
 * Kept pure so it can be unit-tested without a database and reused by the
 * query layer (list filter) and the UI (display label) — the same factoring
 * the rest of the subp domain uses.
 */

export type VeteranEligibilitySource = 'va_confirmed' | 'self_reported';

export interface VeteranEligibilityInput {
  eligibilitySource: VeteranEligibilitySource;
  caseworkerVerified: boolean;
}

/** True when the subject counts as veteran-eligible per the SUBP-006a rule. */
export function isVeteranEligible(input: VeteranEligibilityInput): boolean {
  if (input.eligibilitySource === 'va_confirmed') return true;
  return input.caseworkerVerified;
}

/** Short human label for the eligibility state, for list/detail display. */
export function describeVeteranEligibility(input: VeteranEligibilityInput): string {
  if (input.eligibilitySource === 'va_confirmed') return 'VA-confirmed';
  return input.caseworkerVerified ? 'Self-reported · verified' : 'Self-reported · unverified';
}
