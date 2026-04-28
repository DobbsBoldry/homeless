/**
 * Pure FormData parser for the DTRS-010 FERPA agreement intake form.
 *
 * No 'use server' directive — kept pure so it can be imported and
 * unit-tested by vitest without Next.js server-action wrapping.
 * The action file (`partner-agreements.ts`) delegates to this function.
 * See STATE.md known quirk: Next.js 'use server' × vitest incompatibility.
 */

import { FERPA_SCOPE_OPTIONS } from '@/lib/dtrs';

const FERPA_SCOPE_VALUES = FERPA_SCOPE_OPTIONS.map((o) => o.value);

export type ParsedFerpaAgreementInput = {
  partnerOrgId: string;
  effectiveDate: string; // YYYY-MM-DD
  endDate: string | null; // YYYY-MM-DD or null (open-ended)
  signedByPartner: string | null;
  notes: string | null;
  terms: {
    kind: 'ferpa';
    scope: string[];
    district_name: string;
    liaison_contact: { name: string; email: string; phone?: string };
    studies_exception_invoked: boolean;
    data_destruction_due: 'on_termination' | 'after_5_years' | 'never_required';
  };
};

/**
 * Parse + validate a FormData from the FERPA agreement intake form.
 *
 * FormData shape:
 *   partnerOrgId           — uuid of the school partner_org
 *   effectiveDate          — YYYY-MM-DD (required)
 *   endDate                — YYYY-MM-DD (optional — open-ended if empty)
 *   signedByPartner        — text (optional)
 *   notes                  — text (optional)
 *   district_name          — text (required, mirrors partner org name but editable)
 *   liaison_name           — text (required)
 *   liaison_email          — text (required, basic format check)
 *   liaison_phone          — text (optional)
 *   scope_{value}          — checkbox "on" when checked (per FERPA_SCOPE_OPTIONS)
 *   studies_exception      — "true" | "false"
 *   data_destruction_due   — 'on_termination' | 'after_5_years' | 'never_required'
 */
export function parsePartnerAgreementForm(
  formData: FormData,
): { ok: true; input: ParsedFerpaAgreementInput } | { ok: false; error: string } {
  const str = (key: string) => (formData.get(key) ?? '').toString().trim();

  // partnerOrgId
  const partnerOrgId = str('partnerOrgId');
  if (!partnerOrgId) return { ok: false, error: 'School district is required.' };

  // effectiveDate
  const effectiveDateRaw = str('effectiveDate');
  if (!effectiveDateRaw) return { ok: false, error: 'Effective date is required.' };
  if (Number.isNaN(Date.parse(effectiveDateRaw))) {
    return { ok: false, error: 'Effective date is not a valid date.' };
  }

  // endDate (optional)
  const endDateRaw = str('endDate');
  let endDate: string | null = null;
  if (endDateRaw) {
    if (Number.isNaN(Date.parse(endDateRaw))) {
      return { ok: false, error: 'End date is not a valid date.' };
    }
    if (endDateRaw < effectiveDateRaw) {
      return { ok: false, error: 'End date must be on or after effective date.' };
    }
    endDate = endDateRaw;
  }

  // signedByPartner (optional)
  const signedByPartnerRaw = str('signedByPartner');
  const signedByPartner = signedByPartnerRaw || null;

  // notes (optional, max 2000)
  const notesRaw = str('notes');
  const notes = notesRaw || null;
  if (notes && notes.length > 2000) {
    return { ok: false, error: 'Notes must be 2 000 characters or fewer.' };
  }

  // terms: district_name
  const district_name = str('district_name');
  if (!district_name) return { ok: false, error: 'District name is required.' };

  // terms: liaison_contact
  const liaison_name = str('liaison_name');
  if (!liaison_name) return { ok: false, error: 'Liaison name is required.' };

  const liaison_email = str('liaison_email');
  if (!liaison_email) return { ok: false, error: 'Liaison email is required.' };
  if (!liaison_email.includes('@')) {
    return { ok: false, error: 'Liaison email must be a valid email address.' };
  }

  const liaison_phone_raw = str('liaison_phone');
  const liaison_phone = liaison_phone_raw || undefined;

  // terms: scope (checkboxes)
  const scope: string[] = [];
  for (const opt of FERPA_SCOPE_VALUES) {
    const val = formData.get(`scope_${opt}`);
    if (val === 'on' || val === 'true' || val === opt) {
      scope.push(opt);
    }
  }
  if (scope.length === 0) {
    return { ok: false, error: 'At least one data scope must be selected.' };
  }

  // terms: studies_exception_invoked
  const studiesExceptionRaw = str('studies_exception');
  if (studiesExceptionRaw !== 'true' && studiesExceptionRaw !== 'false') {
    return { ok: false, error: 'Studies exception selection is required.' };
  }
  const studies_exception_invoked = studiesExceptionRaw === 'true';

  // terms: data_destruction_due
  const VALID_DESTRUCTION = ['on_termination', 'after_5_years', 'never_required'] as const;
  type DestructionValue = (typeof VALID_DESTRUCTION)[number];
  const data_destruction_due_raw = str('data_destruction_due');
  if (!VALID_DESTRUCTION.includes(data_destruction_due_raw as DestructionValue)) {
    return { ok: false, error: 'Data destruction policy selection is required.' };
  }
  const data_destruction_due = data_destruction_due_raw as DestructionValue;

  return {
    ok: true,
    input: {
      partnerOrgId,
      effectiveDate: effectiveDateRaw,
      endDate,
      signedByPartner,
      notes,
      terms: {
        kind: 'ferpa',
        scope,
        district_name,
        liaison_contact: {
          name: liaison_name,
          email: liaison_email,
          phone: liaison_phone,
        },
        studies_exception_invoked,
        data_destruction_due,
      },
    },
  };
}
