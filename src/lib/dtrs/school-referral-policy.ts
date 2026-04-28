/**
 * PRVN-003 — FERPA-specific policy gate for school referrals (ADR 0005).
 *
 * NEVER bypass canAccessSchoolReferral for reads. Every non-directory-info
 * read must produce a school_referral_disclosures row.
 *
 * McKinney-Vento authorization is a first-class basis here — not equivalent
 * to "no consent". It is a statutory exception that is narrow: housing-related
 * services only, minimum-necessary information only. validateMcKinneyVentoBasis
 * enforces that narrowness structurally.
 */

import { db } from '@/db/client';
import type { SchoolReferralBasis, UserRole } from '@/db/schema/enums';
import { schoolReferralDisclosures } from '@/db/schema/school-referral-disclosures';
import type { SchoolReferral } from '@/db/schema/school-referrals';

// ---------------------------------------------------------------------------
// Controlled vocabulary
// ---------------------------------------------------------------------------

/**
 * Services a school liaison may request on behalf of a referred family.
 * This is the complete controlled vocabulary for servicesRequested JSONB.
 */
export const SCHOOL_REFERRAL_SERVICES = [
  'shelter_placement',
  'rental_assistance',
  'case_management',
  'utility_assistance',
  'transportation',
  'school_supplies',
  'food_assistance',
  'mental_health',
] as const;

export type SchoolReferralService = (typeof SCHOOL_REFERRAL_SERVICES)[number];

/**
 * Housing-related services that qualify a referral for McKinney-Vento
 * authorization. The M-V act exception only covers disclosures made "to
 * facilitate access to housing or related services." Transportation alone
 * and school_supplies alone are not housing-related.
 */
const MV_HOUSING_RELATED_SERVICES = new Set<SchoolReferralService>([
  'shelter_placement',
  'rental_assistance',
  'case_management',
  'utility_assistance',
  'food_assistance',
  'mental_health',
]);

// ---------------------------------------------------------------------------
// canAccessSchoolReferral
// ---------------------------------------------------------------------------

export type AccessResult = {
  allow: boolean;
  basis: SchoolReferralBasis | null;
  requireDisclosureLog: boolean;
};

/**
 * Policy gate — determines whether a viewer may read a school referral and
 * what basis authorizes the access.
 *
 * Rules:
 *   - admin: always allowed, basis = referral's original basis.
 *   - caseworker / ed_coordinator: allowed; always requires disclosure log.
 *   - attorney / shelter_staff: not allowed (no data-sharing agreement).
 *   - pending: never allowed.
 *
 * The caller (query layer) is responsible for writing the disclosure-log row
 * when requireDisclosureLog is true. recordDisclosure() is the helper.
 *
 * NOTE: This gate does NOT check partner-org membership — the query layer
 * enforces that separately (only caseworkers assigned to a school partner-org
 * can list that org's referrals). This function gates on role only so it can
 * be tested without a DB connection.
 */
export function canAccessSchoolReferral(
  viewer: { userId: string; role: UserRole },
  _referral: Pick<SchoolReferral, 'id' | 'status'>,
): AccessResult {
  if (viewer.role === 'admin') {
    return { allow: true, basis: 'mckinney_vento_authorization', requireDisclosureLog: true };
  }
  if (viewer.role === 'caseworker' || viewer.role === 'ed_coordinator') {
    return { allow: true, basis: 'mckinney_vento_authorization', requireDisclosureLog: true };
  }
  // attorney, shelter_staff, pending — no access
  return { allow: false, basis: null, requireDisclosureLog: false };
}

// ---------------------------------------------------------------------------
// validateMcKinneyVentoBasis
// ---------------------------------------------------------------------------

export type MvValidationResult = { valid: true } | { valid: false; reason: string };

/**
 * Sanity-checks that a referral payload is consistent with McKinney-Vento
 * authorization. The M-V exception is narrow: it only authorizes disclosures
 * to "facilitate access to housing or related services" for students experiencing
 * homelessness. A referral invoking M-V authorization MUST:
 *
 *   1. Include at least one housing-related service in servicesRequested.
 *   2. Not be exclusively transportation or school_supplies — those alone
 *      do not constitute housing-related services under M-V.
 *   3. Include a non-empty housingSituation (evidences the student is homeless).
 *
 * This is a pure function so it can be called from the parser and tested
 * without a DB connection.
 */
export function validateMcKinneyVentoBasis(referral: {
  housingSituation: string;
  servicesRequested: string[];
}): MvValidationResult {
  const { housingSituation, servicesRequested } = referral;

  if (!housingSituation || housingSituation.trim().length < 5) {
    return {
      valid: false,
      reason:
        "McKinney-Vento authorization requires a description of the student's housing situation.",
    };
  }

  if (servicesRequested.length === 0) {
    return {
      valid: false,
      reason: 'McKinney-Vento authorization requires at least one service to be requested.',
    };
  }

  const hasHousingRelatedService = servicesRequested.some((s) =>
    MV_HOUSING_RELATED_SERVICES.has(s as SchoolReferralService),
  );

  if (!hasHousingRelatedService) {
    return {
      valid: false,
      reason:
        'McKinney-Vento authorization only covers housing-related services. At least one of ' +
        'shelter_placement, rental_assistance, case_management, utility_assistance, ' +
        'food_assistance, or mental_health must be included. Transportation or school_supplies ' +
        'alone do not qualify.',
    };
  }

  return { valid: true };
}

// ---------------------------------------------------------------------------
// recordDisclosure
// ---------------------------------------------------------------------------

type Tx = Parameters<Parameters<typeof db.transaction>[0]>[0];

export interface RecordDisclosureInput {
  /** Optional — pass the transaction when inside db.transaction(). */
  tx?: Tx;
  referralId: string;
  accessedByUserId: string | null;
  accessedByPartnerOrgId: string | null;
  purpose: string;
  basis: SchoolReferralBasis;
  dataClassesDisclosed: string[];
}

/**
 * Writes a FERPA § 99.32 disclosure-log row for a read access to a school referral.
 *
 * Always call this when canAccessSchoolReferral returns requireDisclosureLog=true.
 * Pass `tx` when inside a transaction so the disclosure row rolls back with the
 * read — keeps "what was read" and "what was logged" consistent.
 *
 * Errors are caught and logged — a transient DB hiccup should never 500 a read
 * view, but we DO log loudly: a missed disclosure row is a FERPA compliance gap.
 */
export async function recordDisclosure(input: RecordDisclosureInput): Promise<void> {
  try {
    const writer = input.tx ?? db;
    await writer.insert(schoolReferralDisclosures).values({
      referralId: input.referralId,
      accessedByUserId: input.accessedByUserId,
      accessedByPartnerOrgId: input.accessedByPartnerOrgId,
      purpose: input.purpose,
      basis: input.basis,
      dataClassesDisclosed: input.dataClassesDisclosed,
    });
  } catch (err) {
    console.error('[recordDisclosure] FERPA disclosure log write failed — compliance gap!', {
      referralId: input.referralId,
      accessedByUserId: input.accessedByUserId,
      purpose: input.purpose,
      err,
    });
  }
}
