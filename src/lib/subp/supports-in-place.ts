/**
 * SUBP-001 — supports-in-place value validation + UI helpers.
 *
 * The schema stores `supports_in_place` as JSONB. This module enforces
 * the structural contract, mirroring the `partner-agreements.ts`
 * validator pattern: pure functions, throw on invalid shape, return
 * typed value on success.
 */

import type { SupportsInPlace } from '@/db/schema/foster-youth';

const HOUSING_VALUES = ['unknown', 'none', 'in_progress', 'documented'] as const;
const MEDICAID_VALUES = ['unknown', 'not_filed', 'drafted', 'submitted', 'approved'] as const;
const EDUCATION_VALUES = ['unknown', 'none', 'high_school', 'post_secondary_enrolled'] as const;
const EMPLOYMENT_VALUES = ['unknown', 'none', 'searching', 'employed'] as const;

export const HOUSING_PLAN_OPTIONS = [
  { value: 'unknown' as const, label: 'Unknown' },
  { value: 'none' as const, label: 'No plan' },
  { value: 'in_progress' as const, label: 'Plan in progress' },
  { value: 'documented' as const, label: 'Documented housing plan' },
];

export const MEDICAID_OPTIONS = [
  { value: 'unknown' as const, label: 'Unknown' },
  { value: 'not_filed' as const, label: 'Not filed' },
  { value: 'drafted' as const, label: 'Drafted' },
  { value: 'submitted' as const, label: 'Submitted' },
  { value: 'approved' as const, label: 'Approved' },
];

export const EDUCATION_OPTIONS = [
  { value: 'unknown' as const, label: 'Unknown' },
  { value: 'none' as const, label: 'No plan' },
  { value: 'high_school' as const, label: 'On track for high-school completion' },
  { value: 'post_secondary_enrolled' as const, label: 'Enrolled post-secondary' },
];

export const EMPLOYMENT_OPTIONS = [
  { value: 'unknown' as const, label: 'Unknown' },
  { value: 'none' as const, label: 'No plan' },
  { value: 'searching' as const, label: 'Actively searching' },
  { value: 'employed' as const, label: 'Employed' },
];

export function validateSupportsInPlace(input: unknown): SupportsInPlace {
  if (typeof input !== 'object' || input === null) {
    throw new Error('supports_in_place must be an object');
  }
  const { housing_plan, medicaid_extension, education_plan, employment_plan } = input as {
    housing_plan?: unknown;
    medicaid_extension?: unknown;
    education_plan?: unknown;
    employment_plan?: unknown;
  };

  if (!HOUSING_VALUES.includes(housing_plan as (typeof HOUSING_VALUES)[number])) {
    throw new Error(`supports_in_place.housing_plan must be one of: ${HOUSING_VALUES.join(', ')}`);
  }
  if (!MEDICAID_VALUES.includes(medicaid_extension as (typeof MEDICAID_VALUES)[number])) {
    throw new Error(
      `supports_in_place.medicaid_extension must be one of: ${MEDICAID_VALUES.join(', ')}`,
    );
  }
  if (!EDUCATION_VALUES.includes(education_plan as (typeof EDUCATION_VALUES)[number])) {
    throw new Error(
      `supports_in_place.education_plan must be one of: ${EDUCATION_VALUES.join(', ')}`,
    );
  }
  if (!EMPLOYMENT_VALUES.includes(employment_plan as (typeof EMPLOYMENT_VALUES)[number])) {
    throw new Error(
      `supports_in_place.employment_plan must be one of: ${EMPLOYMENT_VALUES.join(', ')}`,
    );
  }

  return {
    housing_plan: housing_plan as SupportsInPlace['housing_plan'],
    medicaid_extension: medicaid_extension as SupportsInPlace['medicaid_extension'],
    education_plan: education_plan as SupportsInPlace['education_plan'],
    employment_plan: employment_plan as SupportsInPlace['employment_plan'],
  };
}

/**
 * Number of plan dimensions where the youth has a real status (not
 * 'unknown' or 'none'). Used by the caseworker list to color the
 * "supports in place" indicator.
 */
export function countSupportsInPlace(s: SupportsInPlace): number {
  let n = 0;
  if (s.housing_plan === 'in_progress' || s.housing_plan === 'documented') n += 1;
  if (
    s.medicaid_extension === 'drafted' ||
    s.medicaid_extension === 'submitted' ||
    s.medicaid_extension === 'approved'
  )
    n += 1;
  if (s.education_plan === 'high_school' || s.education_plan === 'post_secondary_enrolled') n += 1;
  if (s.employment_plan === 'searching' || s.employment_plan === 'employed') n += 1;
  return n;
}
