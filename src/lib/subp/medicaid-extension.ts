/**
 * SUBP-002 — TEAMKY Former Foster Youth Medicaid extension domain logic.
 *
 * Pure functions: eligibility check and state-transition guard. No DB,
 * no clocks. Caller passes `asOf` so tests + Inngest reminders are
 * replayable.
 *
 * Eligibility: 42 U.S.C. § 1396a(a)(10)(A)(i)(IX) extends Medicaid to
 * former foster youth up to age 26. Kentucky-specific implementation:
 *   - Must have been in foster care in Kentucky on or after the
 *     youth's 18th birthday.
 *   - Must currently be < 26 years old.
 *   - Must be a Kentucky resident at the time of application.
 *
 * The eligibility check here covers (a) and (b); residency (c) is a
 * runtime check at the form layer (asks the caseworker; not modeled
 * structurally).
 */
import type { MedicaidExtensionStatus } from '@/db/schema/enums';
import type { MedicaidExtensionPayload } from '@/db/schema/medicaid-extension-applications';
import { computeDaysUntilEighteen } from './aging-out-engine';

// ---------------------------------------------------------------------------
// Eligibility
// ---------------------------------------------------------------------------

export type EligibilityInput = {
  /** From foster_youth.dateOfBirth. */
  dateOfBirth: Date | string;
  /** Status at time of check; if 'aged_out' or 'exited' the youth is past 18. */
  status: 'active' | 'aged_out' | 'exited';
  /** From the application payload — was the youth in KY foster care at 18? */
  inFosterCareAt18: boolean;
};

export type EligibilityResult =
  | { eligible: true }
  | { eligible: false; reasons: EligibilityDenialReason[] };

export type EligibilityDenialReason = 'under_18' | 'over_25' | 'not_in_foster_care_at_18';

/**
 * The eligible window is 18 → 26. That's 8 years past the 18th birthday.
 * If `daysUntil18` is more negative than this (i.e. further into the
 * past), the youth is over 26.
 */
const EIGHT_YEARS_IN_DAYS = 8 * 365.25;

/**
 * Check whether a youth meets the federal + KY-specific eligibility
 * gates. Pure: no DB, no clocks.
 *
 * Note: the under-26 cutoff is computed from days-until-18: if days
 * until 18 are between -8 years (i.e. the youth's 26th birthday) and 0
 * (today is the 18th birthday), they're in the eligible window.
 */
export function isEligibleForExtension(
  input: EligibilityInput,
  asOf: Date | string,
): EligibilityResult {
  const reasons: EligibilityDenialReason[] = [];

  const daysUntil18 = computeDaysUntilEighteen(input.dateOfBirth, asOf);

  // Under 18: the federal extension applies only to *former* foster
  // youth. Active foster care (still under 18) means regular Medicaid
  // continues without this extension.
  if (daysUntil18 > 0) {
    reasons.push('under_18');
  }

  // Over 26: the extension caps at the 26th birthday. The 26th birthday
  // is 8 years past the 18th birthday. If days_until_18 is more negative
  // than -8y, the youth is past 26.
  if (daysUntil18 < -EIGHT_YEARS_IN_DAYS) {
    reasons.push('over_25');
  }

  if (!input.inFosterCareAt18) {
    reasons.push('not_in_foster_care_at_18');
  }

  if (reasons.length > 0) return { eligible: false, reasons };
  return { eligible: true };
}

// ---------------------------------------------------------------------------
// Status transitions
// ---------------------------------------------------------------------------

/**
 * Allowed transitions per the SUBP-002 state machine. Any transition not
 * in this map is rejected — prevents skipping (drafted → approved
 * directly) and re-opening (approved → drafted).
 *
 * Withdrawal is allowed from any non-terminal state.
 */
const ALLOWED_TRANSITIONS: Record<MedicaidExtensionStatus, MedicaidExtensionStatus[]> = {
  drafted: ['submitted', 'withdrawn'],
  submitted: ['approved', 'denied', 'withdrawn'],
  approved: [], // terminal
  denied: ['withdrawn'], // can withdraw a denial; need a fresh draft to retry
  withdrawn: [], // terminal
};

export function isValidTransition(
  from: MedicaidExtensionStatus,
  to: MedicaidExtensionStatus,
): boolean {
  return ALLOWED_TRANSITIONS[from].includes(to);
}

export function assertValidTransition(
  from: MedicaidExtensionStatus,
  to: MedicaidExtensionStatus,
): void {
  if (!isValidTransition(from, to)) {
    throw new Error(
      `Invalid medicaid_extension status transition: ${from} → ${to}. ` +
        `Allowed from ${from}: ${ALLOWED_TRANSITIONS[from].join(', ') || '(none — terminal)'}`,
    );
  }
}

// ---------------------------------------------------------------------------
// Payload validation
// ---------------------------------------------------------------------------

const STUDENT_VALUES = ['unknown', 'not_in_school', 'high_school', 'post_secondary'] as const;
const EMPLOYMENT_VALUES = ['unknown', 'unemployed', 'part_time', 'full_time'] as const;

export function validateApplicationPayload(input: unknown): MedicaidExtensionPayload {
  if (typeof input !== 'object' || input === null) {
    throw new Error('application_payload must be an object');
  }
  const {
    in_foster_care_at_18,
    student_status,
    employment_status,
    current_address_synthetic,
    caseworker_notes,
  } = input as {
    in_foster_care_at_18?: unknown;
    student_status?: unknown;
    employment_status?: unknown;
    current_address_synthetic?: unknown;
    caseworker_notes?: unknown;
  };

  if (typeof in_foster_care_at_18 !== 'boolean') {
    throw new Error('application_payload.in_foster_care_at_18 must be a boolean');
  }
  if (!STUDENT_VALUES.includes(student_status as (typeof STUDENT_VALUES)[number])) {
    throw new Error(
      `application_payload.student_status must be one of: ${STUDENT_VALUES.join(', ')}`,
    );
  }
  if (!EMPLOYMENT_VALUES.includes(employment_status as (typeof EMPLOYMENT_VALUES)[number])) {
    throw new Error(
      `application_payload.employment_status must be one of: ${EMPLOYMENT_VALUES.join(', ')}`,
    );
  }
  if (typeof current_address_synthetic !== 'string' || !current_address_synthetic.trim()) {
    throw new Error('application_payload.current_address_synthetic is required');
  }
  if (caseworker_notes !== undefined && typeof caseworker_notes !== 'string') {
    throw new Error('application_payload.caseworker_notes must be a string when provided');
  }
  if (typeof caseworker_notes === 'string' && caseworker_notes.length > 2000) {
    throw new Error('application_payload.caseworker_notes must be 2 000 chars or fewer');
  }

  return {
    in_foster_care_at_18,
    student_status: student_status as MedicaidExtensionPayload['student_status'],
    employment_status: employment_status as MedicaidExtensionPayload['employment_status'],
    current_address_synthetic,
    caseworker_notes: caseworker_notes as string | undefined,
  };
}

export const STUDENT_STATUS_OPTIONS = [
  { value: 'unknown' as const, label: 'Unknown' },
  { value: 'not_in_school' as const, label: 'Not currently enrolled' },
  { value: 'high_school' as const, label: 'High-school student' },
  { value: 'post_secondary' as const, label: 'Post-secondary enrolled' },
];

export const EMPLOYMENT_STATUS_OPTIONS = [
  { value: 'unknown' as const, label: 'Unknown' },
  { value: 'unemployed' as const, label: 'Unemployed' },
  { value: 'part_time' as const, label: 'Part-time' },
  { value: 'full_time' as const, label: 'Full-time' },
];
