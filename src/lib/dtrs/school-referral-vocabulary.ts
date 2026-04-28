/**
 * PRVN-003 — controlled vocabulary for school referrals.
 *
 * Extracted from school-referral-policy.ts so that `'use client'` components
 * (the liaison intake form) can deep-import these constants without pulling
 * postgres into the browser bundle. The policy module itself imports `db`
 * (for disclosure-log writes) and Sentry — both server-only — so any client
 * component that touched `school-referral-policy` would fail the next build
 * with `Module not found: Can't resolve 'tls' / 'fs' / ...`.
 *
 * This file is pure data + types only. Server-side code may import either
 * file; client components must use this one.
 */

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
export const MV_HOUSING_RELATED_SERVICES: ReadonlySet<SchoolReferralService> =
  new Set<SchoolReferralService>([
    'shelter_placement',
    'rental_assistance',
    'case_management',
    'utility_assistance',
    'food_assistance',
    'mental_health',
  ]);
