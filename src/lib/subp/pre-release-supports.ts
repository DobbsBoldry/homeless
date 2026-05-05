/**
 * SUBP-005 — pre-release supports value validation + UI helpers.
 *
 * The schema stores `supports_in_place` as JSONB. This module enforces
 * the structural contract for the reentry pathway, mirroring the
 * `supports-in-place.ts` validator pattern used for foster aging-out
 * (SUBP-001). Pure functions, throw on invalid shape, return typed value.
 */

import type { PreReleaseSupports } from '@/db/schema/pre-release-subjects';

const HOUSING_INTENT_VALUES = [
  'unknown',
  'none',
  'in_progress',
  'documented',
  'confirmed',
] as const;
const EMPLOYMENT_VALUES = ['unknown', 'none', 'searching', 'committed'] as const;
const MEDICAID_VALUES = ['unknown', 'suspended', 'resumption_filed', 'resumed'] as const;
const TREATMENT_VALUES = ['unknown', 'not_applicable', 'none', 'planned', 'in_place'] as const;
const FAMILY_VALUES = ['unknown', 'none', 'in_progress', 'documented'] as const;

export const HOUSING_INTENT_OPTIONS = [
  { value: 'unknown' as const, label: 'Unknown' },
  { value: 'none' as const, label: 'No plan' },
  { value: 'in_progress' as const, label: 'Plan in progress' },
  { value: 'documented' as const, label: 'Documented intent' },
  { value: 'confirmed' as const, label: 'Confirmed (lease / placement secured)' },
];

export const EMPLOYMENT_PLAN_OPTIONS = [
  { value: 'unknown' as const, label: 'Unknown' },
  { value: 'none' as const, label: 'No plan' },
  { value: 'searching' as const, label: 'Actively searching' },
  { value: 'committed' as const, label: 'Committed (offer / placement)' },
];

export const MEDICAID_STATUS_OPTIONS = [
  { value: 'unknown' as const, label: 'Unknown' },
  { value: 'suspended' as const, label: 'Suspended (incarceration)' },
  { value: 'resumption_filed' as const, label: 'Resumption filed' },
  { value: 'resumed' as const, label: 'Resumed' },
];

export const TREATMENT_CONTINUITY_OPTIONS = [
  { value: 'unknown' as const, label: 'Unknown' },
  { value: 'not_applicable' as const, label: 'Not applicable' },
  { value: 'none' as const, label: 'No plan' },
  { value: 'planned' as const, label: 'Plan documented' },
  { value: 'in_place' as const, label: 'Provider in place' },
];

export const FAMILY_CONNECTION_OPTIONS = [
  { value: 'unknown' as const, label: 'Unknown' },
  { value: 'none' as const, label: 'No connection' },
  { value: 'in_progress' as const, label: 'Building connection' },
  { value: 'documented' as const, label: 'Documented family plan' },
];

export function validatePreReleaseSupports(input: unknown): PreReleaseSupports {
  if (typeof input !== 'object' || input === null) {
    throw new Error('supports_in_place must be an object');
  }
  const {
    housing_intent,
    employment_plan,
    medicaid_status,
    treatment_continuity,
    family_connection,
  } = input as {
    housing_intent?: unknown;
    employment_plan?: unknown;
    medicaid_status?: unknown;
    treatment_continuity?: unknown;
    family_connection?: unknown;
  };

  if (!HOUSING_INTENT_VALUES.includes(housing_intent as (typeof HOUSING_INTENT_VALUES)[number])) {
    throw new Error(
      `supports_in_place.housing_intent must be one of: ${HOUSING_INTENT_VALUES.join(', ')}`,
    );
  }
  if (!EMPLOYMENT_VALUES.includes(employment_plan as (typeof EMPLOYMENT_VALUES)[number])) {
    throw new Error(
      `supports_in_place.employment_plan must be one of: ${EMPLOYMENT_VALUES.join(', ')}`,
    );
  }
  if (!MEDICAID_VALUES.includes(medicaid_status as (typeof MEDICAID_VALUES)[number])) {
    throw new Error(
      `supports_in_place.medicaid_status must be one of: ${MEDICAID_VALUES.join(', ')}`,
    );
  }
  if (!TREATMENT_VALUES.includes(treatment_continuity as (typeof TREATMENT_VALUES)[number])) {
    throw new Error(
      `supports_in_place.treatment_continuity must be one of: ${TREATMENT_VALUES.join(', ')}`,
    );
  }
  if (!FAMILY_VALUES.includes(family_connection as (typeof FAMILY_VALUES)[number])) {
    throw new Error(
      `supports_in_place.family_connection must be one of: ${FAMILY_VALUES.join(', ')}`,
    );
  }

  return {
    housing_intent: housing_intent as PreReleaseSupports['housing_intent'],
    employment_plan: employment_plan as PreReleaseSupports['employment_plan'],
    medicaid_status: medicaid_status as PreReleaseSupports['medicaid_status'],
    treatment_continuity: treatment_continuity as PreReleaseSupports['treatment_continuity'],
    family_connection: family_connection as PreReleaseSupports['family_connection'],
  };
}

/**
 * Count of supports dimensions where the subject has a real status (not
 * 'unknown' / 'none' / 'not_applicable'). Used to color the caseworker
 * list "supports in place" indicator.
 */
export function countPreReleaseSupportsInPlace(s: PreReleaseSupports): number {
  let n = 0;
  if (
    s.housing_intent === 'in_progress' ||
    s.housing_intent === 'documented' ||
    s.housing_intent === 'confirmed'
  ) {
    n += 1;
  }
  if (s.employment_plan === 'searching' || s.employment_plan === 'committed') n += 1;
  if (s.medicaid_status === 'resumption_filed' || s.medicaid_status === 'resumed') n += 1;
  if (s.treatment_continuity === 'planned' || s.treatment_continuity === 'in_place') n += 1;
  if (s.family_connection === 'in_progress' || s.family_connection === 'documented') n += 1;
  return n;
}
