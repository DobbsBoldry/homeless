/**
 * Pure FormData parser for the PRVN-003 school-referral intake form.
 *
 * Kept separate (no 'use server') so it can be unit-tested without Next.js
 * server-action wrapping. The action (school-referrals.ts) delegates to this.
 *
 * Basis-specific validation:
 *   - mckinney_vento_authorization: mvAttestationChecked must be 'true'.
 *   - parental_consent / eligible_student_consent: consentSignedAt required.
 */
import type {
  SchoolReferralBasis,
  SchoolReferralGradeBand,
  SchoolReferralUrgency,
} from '@/db/schema/enums';
import { SCHOOL_REFERRAL_SERVICES } from '@/lib/dtrs';

const VALID_BASES: readonly SchoolReferralBasis[] = [
  'mckinney_vento_authorization',
  'parental_consent',
  'eligible_student_consent',
];

const VALID_GRADE_BANDS: readonly SchoolReferralGradeBand[] = ['elementary', 'middle', 'high'];
const VALID_URGENCIES: readonly SchoolReferralUrgency[] = ['low', 'medium', 'high'];

export type ParsedSchoolReferralInput = {
  partnerOrgId: string;
  studentFirstInitial: string;
  studentAge: number | null;
  studentGradeBand: SchoolReferralGradeBand | null;
  guardianName: string;
  guardianContact: string;
  housingSituation: string;
  servicesRequested: string[];
  urgency: SchoolReferralUrgency;
  notes: string | null;
  basis: SchoolReferralBasis;
  /** Set true when basis=mckinney_vento_authorization and liaison checked attestation. */
  mvAuthorizationConfirmed: boolean;
  /** Set when basis=parental_consent or eligible_student_consent. */
  consentSignedAt: Date | null;
  consentSignedMethod: string | null;
  consentConsenterName: string | null;
  consentConsenterRelationship: string | null;
};

type ParseResult = { ok: true; input: ParsedSchoolReferralInput } | { ok: false; error: string };

function str(fd: FormData, key: string): string {
  return (fd.get(key) ?? '').toString().trim();
}

export function parseSchoolReferralForm(formData: FormData): ParseResult {
  const partnerOrgId = str(formData, 'partnerOrgId');
  if (!partnerOrgId) return { ok: false, error: 'School partner org is required.' };

  // Basis
  const basisRaw = str(formData, 'basis');
  if (!basisRaw || !VALID_BASES.includes(basisRaw as SchoolReferralBasis)) {
    return { ok: false, error: 'Authorization basis is required.' };
  }
  const basis = basisRaw as SchoolReferralBasis;

  // Student first initial only — enforce maximum 1 character
  const studentFirstInitial = str(formData, 'studentFirstInitial').toUpperCase();
  if (
    !studentFirstInitial ||
    studentFirstInitial.length !== 1 ||
    !/^[A-Z]$/.test(studentFirstInitial)
  ) {
    return { ok: false, error: 'Student first initial must be a single letter (A–Z).' };
  }

  // Student age — optional
  const studentAgeRaw = str(formData, 'studentAge');
  let studentAge: number | null = null;
  if (studentAgeRaw !== '') {
    const parsed = Number(studentAgeRaw);
    if (!Number.isInteger(parsed) || parsed < 3 || parsed > 21) {
      return { ok: false, error: 'Student age must be a whole number between 3 and 21.' };
    }
    studentAge = parsed;
  }

  // Grade band — optional
  const gradeBandRaw = str(formData, 'studentGradeBand');
  let studentGradeBand: SchoolReferralGradeBand | null = null;
  if (gradeBandRaw !== '') {
    if (!VALID_GRADE_BANDS.includes(gradeBandRaw as SchoolReferralGradeBand)) {
      return { ok: false, error: 'Grade band must be elementary, middle, or high.' };
    }
    studentGradeBand = gradeBandRaw as SchoolReferralGradeBand;
  }

  const guardianName = str(formData, 'guardianName');
  if (!guardianName) return { ok: false, error: 'Guardian name is required.' };

  const guardianContact = str(formData, 'guardianContact');
  if (!guardianContact)
    return { ok: false, error: 'Guardian contact (phone or email) is required.' };

  const housingSituation = str(formData, 'housingSituation');
  if (!housingSituation || housingSituation.length < 5) {
    return {
      ok: false,
      error: 'Housing situation description is required (minimum 5 characters).',
    };
  }
  if (housingSituation.length > 2000) {
    return { ok: false, error: 'Housing situation must be 2 000 characters or fewer.' };
  }

  // Services requested — one or more from controlled vocabulary
  const servicesRaw = formData.getAll('servicesRequested').map((v) => v.toString().trim());
  if (servicesRaw.length === 0) {
    return { ok: false, error: 'At least one service must be selected.' };
  }
  const invalidService = servicesRaw.find(
    (s) => !SCHOOL_REFERRAL_SERVICES.includes(s as (typeof SCHOOL_REFERRAL_SERVICES)[number]),
  );
  if (invalidService) {
    return { ok: false, error: `Unknown service: ${invalidService}` };
  }
  const servicesRequested = servicesRaw;

  // Urgency
  const urgencyRaw = str(formData, 'urgency');
  if (!urgencyRaw || !VALID_URGENCIES.includes(urgencyRaw as SchoolReferralUrgency)) {
    return { ok: false, error: 'Urgency must be low, medium, or high.' };
  }
  const urgency = urgencyRaw as SchoolReferralUrgency;

  // Notes — optional
  const notesRaw = str(formData, 'notes');
  const notes = notesRaw.length > 0 ? notesRaw : null;
  if (notes && notes.length > 2000) {
    return { ok: false, error: 'Notes must be 2 000 characters or fewer.' };
  }

  // Basis-specific fields
  let mvAuthorizationConfirmed = false;
  let consentSignedAt: Date | null = null;
  let consentSignedMethod: string | null = null;
  let consentConsenterName: string | null = null;
  let consentConsenterRelationship: string | null = null;

  if (basis === 'mckinney_vento_authorization') {
    const attested = str(formData, 'mvAttestationChecked');
    if (attested !== 'true') {
      return {
        ok: false,
        error: 'You must attest that this referral falls under McKinney-Vento authorization.',
      };
    }
    mvAuthorizationConfirmed = true;
  } else {
    // parental_consent or eligible_student_consent
    const signedAtRaw = str(formData, 'consentSignedAt');
    if (!signedAtRaw) {
      return { ok: false, error: 'Consent date is required for this authorization basis.' };
    }
    const signedAtDate = new Date(signedAtRaw);
    if (Number.isNaN(signedAtDate.getTime())) {
      return { ok: false, error: 'Consent date is invalid.' };
    }
    consentSignedAt = signedAtDate;
    consentSignedMethod = str(formData, 'consentSignedMethod') || null;
    consentConsenterName = str(formData, 'consentConsenterName') || null;
    consentConsenterRelationship = str(formData, 'consentConsenterRelationship') || null;
  }

  return {
    ok: true,
    input: {
      partnerOrgId,
      studentFirstInitial,
      studentAge,
      studentGradeBand,
      guardianName,
      guardianContact,
      housingSituation,
      servicesRequested,
      urgency,
      notes,
      basis,
      mvAuthorizationConfirmed,
      consentSignedAt,
      consentSignedMethod,
      consentConsenterName,
      consentConsenterRelationship,
    },
  };
}
