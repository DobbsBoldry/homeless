/**
 * Pure FormData parser for the supports-in-place edit form.
 * No 'use server' — vitest-compatible.
 */

import type { SupportsInPlace } from '@/db/schema/foster-youth';
import { validateSupportsInPlace } from '@/lib/subp';

export function parseSupportsInPlaceForm(
  formData: FormData,
): { ok: true; supports: SupportsInPlace } | { ok: false; error: string } {
  const str = (key: string) => (formData.get(key) ?? '').toString().trim();

  const housing_plan = str('housing_plan');
  const medicaid_extension = str('medicaid_extension');
  const education_plan = str('education_plan');
  const employment_plan = str('employment_plan');

  if (!housing_plan || !medicaid_extension || !education_plan || !employment_plan) {
    return { ok: false, error: 'All four supports-in-place fields are required.' };
  }

  try {
    const supports = validateSupportsInPlace({
      housing_plan,
      medicaid_extension,
      education_plan,
      employment_plan,
    });
    return { ok: true, supports };
  } catch (err) {
    return {
      ok: false,
      error: err instanceof Error ? err.message : 'Invalid supports-in-place values.',
    };
  }
}
