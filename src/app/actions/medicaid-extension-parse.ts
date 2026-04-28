/**
 * Pure FormData parser for the SUBP-002 application draft form.
 * No 'use server' — vitest-compatible.
 */

import type { MedicaidExtensionPayload } from '@/db/schema/medicaid-extension-applications';
import { validateApplicationPayload } from '@/lib/subp';

export function parseDraftApplicationForm(
  formData: FormData,
): { ok: true; payload: MedicaidExtensionPayload } | { ok: false; error: string } {
  const str = (key: string) => (formData.get(key) ?? '').toString().trim();

  const inFosterRaw = str('in_foster_care_at_18');
  if (inFosterRaw !== 'true' && inFosterRaw !== 'false') {
    return { ok: false, error: 'Foster-care-at-18 selection is required.' };
  }
  const in_foster_care_at_18 = inFosterRaw === 'true';

  const student_status = str('student_status');
  const employment_status = str('employment_status');
  const current_address_synthetic = str('current_address_synthetic');
  const caseworker_notes = str('caseworker_notes');

  if (!current_address_synthetic) {
    return { ok: false, error: 'Current address is required.' };
  }

  try {
    const payload = validateApplicationPayload({
      in_foster_care_at_18,
      student_status,
      employment_status,
      current_address_synthetic,
      caseworker_notes: caseworker_notes || undefined,
    });
    return { ok: true, payload };
  } catch (err) {
    return {
      ok: false,
      error: err instanceof Error ? err.message : 'Invalid application input.',
    };
  }
}
