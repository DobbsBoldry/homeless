/**
 * SUBP-005 — pure FormData parser for the pre-release supports-update form.
 *
 * No 'use server' directive — kept pure so the function can be imported and
 * unit-tested by vitest without Next.js server-action wrapping.
 * See STATE.md known quirk: Next.js 'use server' × vitest incompatibility.
 */

import type { PreReleaseSupports } from '@/db/schema/pre-release-subjects';
import { validatePreReleaseSupports } from '@/lib/subp';

export function parsePreReleaseSupportsForm(
  formData: FormData,
): { ok: true; supports: PreReleaseSupports } | { ok: false; error: string } {
  const str = (key: string) => (formData.get(key) ?? '').toString().trim();

  const candidate = {
    housing_intent: str('housing_intent'),
    employment_plan: str('employment_plan'),
    medicaid_status: str('medicaid_status'),
    treatment_continuity: str('treatment_continuity'),
    family_connection: str('family_connection'),
  };

  try {
    const supports = validatePreReleaseSupports(candidate);
    return { ok: true, supports };
  } catch (err) {
    return {
      ok: false,
      error: err instanceof Error ? err.message : 'Pre-release supports form is invalid.',
    };
  }
}
