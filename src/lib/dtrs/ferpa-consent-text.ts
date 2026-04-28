/**
 * FERPA consent text for school referrals — PRVN-003 / ADR 0005.
 *
 * Separate from consent-text.ts (HIPAA consent surface) per the fork
 * decision in ADR 0005. Each version string corresponds to a specific
 * regulatory shape. Reading-level target: Flesch-Kincaid grade 6 or below.
 *
 * McKinney-Vento authorization carries no consent text — it is a statutory
 * exception, not a consent record. Consent text is only shown when basis is
 * 'parental_consent' or 'eligible_student_consent'.
 *
 * Bump the version constant when wording materially changes. Old consent rows
 * keep their version stamp. Advisor review required per docs/dtrs-005-advisor-review.md.
 */

export const CURRENT_FERPA_PARENTAL_CONSENT_VERSION = 'ferpa-parental-v1';
export const CURRENT_FERPA_ELIGIBLE_STUDENT_CONSENT_VERSION = 'ferpa-eligible-student-v1';

/** Sentinel for school_referral_consents.consent_text_version when basis is McKinney-Vento.
 * Statutory authorization carries no consent text — the sentinel exists only because
 * consent_text_version is NOT NULL (ADR 0005, Option B for the consent_text_version
 * nullability question). */
export const MCKINNEY_VENTO_CONSENT_VERSION_SENTINEL = 'mckinney_vento_v1';

/**
 * Consent text shown to a parent or guardian before a school liaison submits
 * a referral for their child.
 *
 * Basis: FERPA § 99.30 — parental consent for disclosure of education records.
 */
export const FERPA_PARENTAL_CONSENT_V1 = {
  version: CURRENT_FERPA_PARENTAL_CONSENT_VERSION,
  title: "Can we share your child's school referral with our housing team?",
  body:
    'The school is sending a referral to the Daviess County coalition to help your family find housing ' +
    'and related services. By saying yes, you allow the school to share limited information about ' +
    "your family's housing situation with coalition staff. We will only share what is needed to " +
    "connect you with help. We will not share your child's grades, health records, or other school " +
    'records. You can change your mind at any time by contacting the school liaison.',
} as const;

/**
 * Consent text shown to a student who is 18 or older (eligible student under FERPA).
 *
 * Basis: FERPA § 99.30 — eligible-student consent for disclosure of education records.
 * Note: On a student\'s 18th birthday, consent rights transfer from parent to student.
 */
export const FERPA_ELIGIBLE_STUDENT_CONSENT_V1 = {
  version: CURRENT_FERPA_ELIGIBLE_STUDENT_CONSENT_VERSION,
  title: 'Can we share your school referral with our housing team?',
  body:
    'The school is sending a referral to the Daviess County coalition to help you find housing ' +
    'and related services. By saying yes, you allow the school to share limited information about ' +
    'your housing situation with coalition staff. We will only share what is needed to ' +
    'connect you with help. We will not share your grades, health records, or other school records. ' +
    'You can change your mind at any time by contacting your school liaison.',
} as const;

export type FerpaConsentText =
  | typeof FERPA_PARENTAL_CONSENT_V1
  | typeof FERPA_ELIGIBLE_STUDENT_CONSENT_V1;

/**
 * Returns the current consent text object for the given basis.
 * Returns null for McKinney-Vento authorization (statutory, no consent text).
 */
export function ferpaConsentTextFor(
  basis: 'parental_consent' | 'eligible_student_consent',
): FerpaConsentText {
  if (basis === 'parental_consent') return FERPA_PARENTAL_CONSENT_V1;
  return FERPA_ELIGIBLE_STUDENT_CONSENT_V1;
}
