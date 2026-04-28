/**
 * SUBP-007 — school-stability scoring engine.
 *
 * Pure function. Inputs the runtime needs to know to classify a family's
 * school-stability risk; output is a banded risk (low / moderate / high /
 * critical) plus the structured reasons that drove the decision. The
 * reasons array is the source of truth for downstream UI badging and
 * Inngest alert content.
 *
 * Rule sources:
 *   - McKinney-Vento Homeless Assistance Act (42 U.S.C. § 11431 et seq.)
 *     authorizes school-of-origin transportation when families are
 *     experiencing homelessness; protections are most material during
 *     mid-school-year transitions.
 *   - National Center for Homeless Education research: housing
 *     instability mid-year correlates with chronic absenteeism and
 *     credit loss; sheltered + unsheltered are higher-stakes than
 *     doubled-up. (NCHE, "Best Practices in Homeless Education," 2019.)
 *
 * Tiers:
 *   - critical — unsheltered with school-age children (immediate
 *     transport / housing intervention)
 *   - high     — mid-year school change without McKinney-Vento
 *     protection in place
 *   - moderate — mid-year school change WITH McKinney-Vento OR
 *     shelter / hotel housing
 *   - low      — stably housed with stable school enrollment
 */

import type { FamilyHousingStatus } from '@/db/schema/enums';

export type SchoolStabilityRisk = {
  risk: 'low' | 'moderate' | 'high' | 'critical';
  reasons: string[];
};

export type FamilyStabilityInput = {
  childrenCount: number;
  housingStatus: FamilyHousingStatus;
  /**
   * The school the children were enrolled in before the housing transition
   * (per McKinney-Vento). Null if unknown. Identifier only — no name.
   */
  schoolOfOriginId: string | null;
  /**
   * The school the children are currently enrolled in. May differ from
   * school-of-origin when families have moved across district lines and
   * McKinney-Vento transport hasn't kicked in. Null if not enrolled.
   */
  currentSchoolId: string | null;
  /**
   * True if the housing-instability event happened during the academic
   * year (Aug–May) rather than over a summer / break window. Mid-year
   * transitions are higher-stakes per the NCHE evidence.
   */
  midSchoolYear: boolean;
  /**
   * True if at least one child has an active McKinney-Vento identification
   * flag. Drives the contrast between high (no protection) and moderate
   * (protection active).
   */
  anyChildMckinneyVentoEnrolled: boolean;
};

const HOUSING_REASON: Partial<Record<FamilyHousingStatus, string>> = {
  unsheltered: 'housing_unsheltered',
  shelter: 'housing_shelter',
  doubled_up: 'housing_doubled_up',
  hotel: 'housing_hotel',
};

export function computeSchoolStabilityRisk(input: FamilyStabilityInput): SchoolStabilityRisk {
  const reasons: string[] = [];

  if (input.childrenCount === 0) {
    reasons.push('no_school_age_children');
    return { risk: 'low', reasons };
  }

  // Capture the housing reason once so callers can see the full picture.
  const housingReason = HOUSING_REASON[input.housingStatus];
  if (housingReason) reasons.push(housingReason);

  const schoolChanged =
    input.schoolOfOriginId !== null &&
    input.currentSchoolId !== null &&
    input.schoolOfOriginId !== input.currentSchoolId;
  if (schoolChanged) {
    reasons.push('school_changed_mid_year');
    if (input.anyChildMckinneyVentoEnrolled) {
      reasons.push('mckinney_vento_active');
    } else {
      reasons.push('no_mckinney_vento_protection');
    }
  }

  // Tier resolution.
  if (input.housingStatus === 'unsheltered') {
    return { risk: 'critical', reasons };
  }
  if (schoolChanged && input.midSchoolYear && !input.anyChildMckinneyVentoEnrolled) {
    return { risk: 'high', reasons };
  }
  if (
    input.housingStatus === 'shelter' ||
    input.housingStatus === 'hotel' ||
    (schoolChanged && input.midSchoolYear)
  ) {
    return { risk: 'moderate', reasons };
  }
  if (input.housingStatus === 'doubled_up') {
    return { risk: 'moderate', reasons };
  }
  return { risk: 'low', reasons };
}
