/**
 * Pure FormData parsers for partner-agreement intake forms — DTRS-010 (FERPA),
 * DTRS-011 (DCBS DSA), OPRT-002 (MOU).
 *
 * No 'use server' directive — kept pure so functions can be imported and
 * unit-tested by vitest without Next.js server-action wrapping.
 * The action file (`partner-agreements.ts`) delegates to these.
 * See STATE.md known quirk: Next.js 'use server' × vitest incompatibility.
 */

import {
  DCBS_DSA_SCOPE_OPTIONS,
  FERPA_SCOPE_OPTIONS,
  OASIS_DEFAULT_REDACTION_POLICY,
  OASIS_DSA_SCOPE_OPTIONS,
  OASIS_REDACTABLE_FIELDS,
  type OasisRedactionPolicy,
  type OasisRedactionTreatment,
} from '@/lib/dtrs';

const FERPA_SCOPE_VALUES = FERPA_SCOPE_OPTIONS.map((o) => o.value);
const DCBS_DSA_SCOPE_VALUES = DCBS_DSA_SCOPE_OPTIONS.map((o) => o.value);
const OASIS_DSA_SCOPE_VALUES = OASIS_DSA_SCOPE_OPTIONS.map((o) => o.value);
const OASIS_REDACTION_TREATMENTS: readonly OasisRedactionTreatment[] = [
  'share',
  'suppress',
  'aggregate_only',
];

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

// ---------------------------------------------------------------------------
// DTRS-011 — DCBS DSA parser
// ---------------------------------------------------------------------------

export type ParsedDcbsDsaAgreementInput = {
  partnerOrgId: string;
  effectiveDate: string;
  endDate: string | null;
  signedByPartner: string | null;
  notes: string | null;
  terms: {
    kind: 'dsa';
    agency: 'dcbs';
    scope: string[];
    agency_legal_name: string;
    state_contact: { name: string; title: string; email: string; phone?: string };
    population_focus: 'foster_aging_out';
    individual_records_authorized: boolean;
    data_destruction_due: 'on_termination' | 'after_3_years' | 'after_5_years';
  };
};

/**
 * Parse + validate a FormData from the DCBS DSA agreement intake form.
 *
 * FormData shape:
 *   partnerOrgId                       — uuid of the DCBS partner_org
 *   effectiveDate                      — YYYY-MM-DD (required)
 *   endDate                            — YYYY-MM-DD (optional)
 *   signedByPartner                    — text (optional)
 *   notes                              — text (optional)
 *   agency_legal_name                  — text (required)
 *   state_contact_name                 — text (required)
 *   state_contact_title                — text (required)
 *   state_contact_email                — text (required, basic format check)
 *   state_contact_phone                — text (optional)
 *   scope_{value}                      — checkbox "on" when checked
 *   individual_records_authorized      — "true" | "false"
 *   data_destruction_due               — 'on_termination' | 'after_3_years' | 'after_5_years'
 */
export function parseDcbsDsaAgreementForm(
  formData: FormData,
): { ok: true; input: ParsedDcbsDsaAgreementInput } | { ok: false; error: string } {
  const str = (key: string) => (formData.get(key) ?? '').toString().trim();

  const partnerOrgId = str('partnerOrgId');
  if (!partnerOrgId) return { ok: false, error: 'DCBS partner is required.' };

  const effectiveDateRaw = str('effectiveDate');
  if (!effectiveDateRaw) return { ok: false, error: 'Effective date is required.' };
  if (Number.isNaN(Date.parse(effectiveDateRaw))) {
    return { ok: false, error: 'Effective date is not a valid date.' };
  }

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

  const signedByPartner = str('signedByPartner') || null;

  const notes = str('notes') || null;
  if (notes && notes.length > 2000) {
    return { ok: false, error: 'Notes must be 2 000 characters or fewer.' };
  }

  const agency_legal_name = str('agency_legal_name');
  if (!agency_legal_name) {
    return { ok: false, error: 'Agency legal name is required.' };
  }

  const sc_name = str('state_contact_name');
  if (!sc_name) return { ok: false, error: 'State contact name is required.' };

  const sc_title = str('state_contact_title');
  if (!sc_title) return { ok: false, error: 'State contact title is required.' };

  const sc_email = str('state_contact_email');
  if (!sc_email) return { ok: false, error: 'State contact email is required.' };
  if (!sc_email.includes('@')) {
    return { ok: false, error: 'State contact email must be a valid email address.' };
  }

  const sc_phone_raw = str('state_contact_phone');
  const sc_phone = sc_phone_raw || undefined;

  const scope: string[] = [];
  for (const opt of DCBS_DSA_SCOPE_VALUES) {
    const val = formData.get(`scope_${opt}`);
    if (val === 'on' || val === 'true' || val === opt) {
      scope.push(opt);
    }
  }
  if (scope.length === 0) {
    return { ok: false, error: 'At least one data scope must be selected.' };
  }

  const indivAuthRaw = str('individual_records_authorized');
  if (indivAuthRaw !== 'true' && indivAuthRaw !== 'false') {
    return { ok: false, error: 'Individual-records authorization selection is required.' };
  }
  const individual_records_authorized = indivAuthRaw === 'true';

  const VALID_DESTRUCTION = ['on_termination', 'after_3_years', 'after_5_years'] as const;
  type DestructionValue = (typeof VALID_DESTRUCTION)[number];
  const destructionRaw = str('data_destruction_due');
  if (!VALID_DESTRUCTION.includes(destructionRaw as DestructionValue)) {
    return { ok: false, error: 'Data destruction policy selection is required.' };
  }
  const data_destruction_due = destructionRaw as DestructionValue;

  return {
    ok: true,
    input: {
      partnerOrgId,
      effectiveDate: effectiveDateRaw,
      endDate,
      signedByPartner,
      notes,
      terms: {
        kind: 'dsa',
        agency: 'dcbs',
        scope,
        agency_legal_name,
        state_contact: {
          name: sc_name,
          title: sc_title,
          email: sc_email,
          phone: sc_phone,
        },
        population_focus: 'foster_aging_out',
        individual_records_authorized,
        data_destruction_due,
      },
    },
  };
}

// ---------------------------------------------------------------------------
// DTRS-012 — OASIS DSA parser
// ---------------------------------------------------------------------------

export type ParsedOasisDsaAgreementInput = {
  partnerOrgId: string;
  effectiveDate: string;
  endDate: string | null;
  signedByPartner: string | null;
  notes: string | null;
  terms: {
    kind: 'dsa';
    agency: 'oasis';
    scope: string[];
    agency_legal_name: string;
    agency_contact: { name: string; title: string; email: string; phone?: string };
    redaction_policy: OasisRedactionPolicy;
    abuser_blind_attestation: true;
    data_destruction_due: 'on_termination' | 'after_3_years' | 'after_5_years';
  };
};

/**
 * Parse + validate FormData from the OASIS DSA agreement intake form.
 *
 * Per ADR 0007, the abuser-blind attestation is required (the form's submit
 * button is disabled until checked, and this parser fails closed if the box
 * was bypassed). Redaction policy defaults from `OASIS_DEFAULT_REDACTION_POLICY`
 * are applied when a per-field treatment is missing — but every field in
 * `OASIS_REDACTABLE_FIELDS` is then validated against the controlled
 * vocabulary. Bad-shape input is rejected with a user-facing error.
 *
 * FormData shape:
 *   partnerOrgId                       — uuid of the OASIS partner_org
 *   effectiveDate                      — YYYY-MM-DD (required)
 *   endDate                            — YYYY-MM-DD (optional)
 *   signedByPartner                    — text (optional)
 *   notes                              — text (optional)
 *   agency_legal_name                  — text (required)
 *   agency_contact_name                — text (required)
 *   agency_contact_title               — text (required)
 *   agency_contact_email               — text (required, basic format check)
 *   agency_contact_phone               — text (optional)
 *   scope_{value}                      — checkbox "on" when checked
 *   redaction_{field}                  — 'share' | 'suppress' | 'aggregate_only'
 *   abuser_blind_attestation           — "true" required (any other value rejected)
 *   data_destruction_due               — 'on_termination' | 'after_3_years' | 'after_5_years'
 */
export function parseOasisDsaAgreementForm(
  formData: FormData,
): { ok: true; input: ParsedOasisDsaAgreementInput } | { ok: false; error: string } {
  const str = (key: string) => (formData.get(key) ?? '').toString().trim();

  const partnerOrgId = str('partnerOrgId');
  if (!partnerOrgId) return { ok: false, error: 'OASIS partner is required.' };

  const effectiveDateRaw = str('effectiveDate');
  if (!effectiveDateRaw) return { ok: false, error: 'Effective date is required.' };
  if (Number.isNaN(Date.parse(effectiveDateRaw))) {
    return { ok: false, error: 'Effective date is not a valid date.' };
  }

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

  const signedByPartner = str('signedByPartner') || null;

  const notes = str('notes') || null;
  if (notes && notes.length > 2000) {
    return { ok: false, error: 'Notes must be 2 000 characters or fewer.' };
  }

  const agency_legal_name = str('agency_legal_name');
  if (!agency_legal_name) return { ok: false, error: 'Agency legal name is required.' };

  const ac_name = str('agency_contact_name');
  if (!ac_name) return { ok: false, error: 'OASIS contact name is required.' };

  const ac_title = str('agency_contact_title');
  if (!ac_title) return { ok: false, error: 'OASIS contact title is required.' };

  const ac_email = str('agency_contact_email');
  if (!ac_email) return { ok: false, error: 'OASIS contact email is required.' };
  if (!ac_email.includes('@')) {
    return { ok: false, error: 'OASIS contact email must be a valid email address.' };
  }

  const ac_phone = str('agency_contact_phone') || undefined;

  const scope: string[] = [];
  for (const opt of OASIS_DSA_SCOPE_VALUES) {
    const val = formData.get(`scope_${opt}`);
    if (val === 'on' || val === 'true' || val === opt) {
      scope.push(opt);
    }
  }
  if (scope.length === 0) {
    return { ok: false, error: 'At least one data scope must be selected.' };
  }

  const redaction_policy: Partial<OasisRedactionPolicy> = {};
  for (const field of OASIS_REDACTABLE_FIELDS) {
    const raw = str(`redaction_${field}`);
    const treatment = raw || OASIS_DEFAULT_REDACTION_POLICY[field];
    if (!OASIS_REDACTION_TREATMENTS.includes(treatment as OasisRedactionTreatment)) {
      return {
        ok: false,
        error: `Redaction treatment for "${field}" must be one of: ${OASIS_REDACTION_TREATMENTS.join(', ')}.`,
      };
    }
    redaction_policy[field] = treatment as OasisRedactionTreatment;
  }

  const attestationRaw = str('abuser_blind_attestation');
  if (attestationRaw !== 'true') {
    return {
      ok: false,
      error:
        'The abuser-blind attestation must be checked. Recording an OASIS DSA without it is not permitted (ADR 0007).',
    };
  }

  const VALID_DESTRUCTION = ['on_termination', 'after_3_years', 'after_5_years'] as const;
  type DestructionValue = (typeof VALID_DESTRUCTION)[number];
  const destructionRaw = str('data_destruction_due');
  if (!VALID_DESTRUCTION.includes(destructionRaw as DestructionValue)) {
    return { ok: false, error: 'Data destruction policy selection is required.' };
  }
  const data_destruction_due = destructionRaw as DestructionValue;

  return {
    ok: true,
    input: {
      partnerOrgId,
      effectiveDate: effectiveDateRaw,
      endDate,
      signedByPartner,
      notes,
      terms: {
        kind: 'dsa',
        agency: 'oasis',
        scope,
        agency_legal_name,
        agency_contact: {
          name: ac_name,
          title: ac_title,
          email: ac_email,
          phone: ac_phone,
        },
        redaction_policy: redaction_policy as OasisRedactionPolicy,
        abuser_blind_attestation: true,
        data_destruction_due,
      },
    },
  };
}

// ---------------------------------------------------------------------------
// OPRT-002 — MOU parser
// ---------------------------------------------------------------------------

export type ParsedMouAgreementInput = {
  partnerOrgId: string;
  effectiveDate: string;
  endDate: string | null;
  signedByPartner: string | null;
  notes: string | null;
  terms: {
    kind: 'mou';
    phase: 'phase_0' | 'phase_1' | 'standing';
    monthly_meeting_hours: number | null;
    withdrawal_notice_days: number;
  };
};

const MOU_PHASES = ['phase_0', 'phase_1', 'standing'] as const;

export function parseMouAgreementForm(
  formData: FormData,
): { ok: true; input: ParsedMouAgreementInput } | { ok: false; error: string } {
  const str = (key: string) => (formData.get(key) ?? '').toString().trim();

  const partnerOrgId = str('partnerOrgId');
  if (!partnerOrgId) return { ok: false, error: 'Partner is required.' };

  const effectiveDateRaw = str('effectiveDate');
  if (!effectiveDateRaw) return { ok: false, error: 'Effective date is required.' };
  if (Number.isNaN(Date.parse(effectiveDateRaw))) {
    return { ok: false, error: 'Effective date is not a valid date.' };
  }

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

  const signedByPartner = str('signedByPartner') || null;

  const notes = str('notes') || null;
  if (notes && notes.length > 2000) {
    return { ok: false, error: 'Notes must be 2 000 characters or fewer.' };
  }

  const phase = str('phase');
  if (!MOU_PHASES.includes(phase as (typeof MOU_PHASES)[number])) {
    return { ok: false, error: 'Phase selection is required.' };
  }

  const meetingHoursRaw = str('monthly_meeting_hours');
  let monthly_meeting_hours: number | null = null;
  if (meetingHoursRaw) {
    const n = Number(meetingHoursRaw);
    if (!Number.isFinite(n) || n < 0) {
      return { ok: false, error: 'Monthly meeting hours must be a non-negative number.' };
    }
    monthly_meeting_hours = n;
  }

  const withdrawalRaw = str('withdrawal_notice_days');
  if (!withdrawalRaw) {
    return { ok: false, error: 'Withdrawal notice days is required.' };
  }
  const withdrawal_notice_days = Number(withdrawalRaw);
  if (!Number.isInteger(withdrawal_notice_days) || withdrawal_notice_days < 0) {
    return {
      ok: false,
      error: 'Withdrawal notice days must be a non-negative integer.',
    };
  }

  return {
    ok: true,
    input: {
      partnerOrgId,
      effectiveDate: effectiveDateRaw,
      endDate,
      signedByPartner,
      notes,
      terms: {
        kind: 'mou',
        phase: phase as ParsedMouAgreementInput['terms']['phase'],
        monthly_meeting_hours,
        withdrawal_notice_days,
      },
    },
  };
}
