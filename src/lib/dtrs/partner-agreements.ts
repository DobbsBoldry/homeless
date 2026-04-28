/**
 * Partner-agreements domain logic — DTRS-010, DTRS-011, DTRS-012, DTRS-013.
 *
 * Discriminated-union types for the `terms` JSONB column in
 * `partner_agreements`. Each agreement kind owns its terms shape. As of
 * Sprint 12: `ferpa`, `mou`, and `dsa` (DCBS / OASIS / KY DOC variants) are
 * fully specified. `baa`, `qsoa`, `memo_of_cooperation` carry a permissive
 * placeholder until their stories ship.
 *
 * Validators (`validateFerpaTerms`, `validateMouTerms`, `validateDcbsDsaTerms`,
 * `validateOasisDsaTerms`, `validateKyDocDsaTerms`, `validateAgreementTerms`)
 * are pure functions — throw on invalid shape, return typed value on success.
 * They run BEFORE any DB insert so bad data never reaches storage.
 */

import type { PartnerAgreementKind } from '@/db/schema/enums';

// ---------------------------------------------------------------------------
// Controlled vocabulary
// ---------------------------------------------------------------------------

/**
 * FERPA data classes the coalition may receive under the studies-exception
 * framework (20 U.S.C. § 1232g; 34 CFR § 99.31(a)(6)).
 *
 * Single source of truth — the intake form renders checkboxes from this array.
 */
export const FERPA_SCOPE_OPTIONS = [
  {
    value: 'attendance_patterns' as const,
    label: 'Attendance patterns (chronic-absence flags)',
  },
  {
    value: 'address_changes' as const,
    label: 'Address / school-of-origin changes',
  },
  {
    value: 'mckinney_vento_ids' as const,
    label: 'McKinney-Vento identification status',
  },
  {
    value: 'transportation_requests' as const,
    label: 'Transportation assistance requests',
  },
] as const;

export type FerpaScopeValue = (typeof FERPA_SCOPE_OPTIONS)[number]['value'];

/**
 * DCBS-DSA data classes — the foster-aging-out cohort the coalition may
 * receive from the Kentucky Cabinet for Health and Family Services,
 * Department for Community Based Services. Foster youth are in state
 * custody; the legal guardian executing the agreement is the Cabinet, not
 * a parent (see ADR 0006).
 *
 * Single source of truth — the intake form renders checkboxes from this
 * array.
 */
export const DCBS_DSA_SCOPE_OPTIONS = [
  {
    value: 'foster_aging_out_roster' as const,
    label: 'Foster aging-out roster (youth turning 18 within 18 months)',
  },
  {
    value: 'placement_history' as const,
    label: 'Placement history and changes',
  },
  {
    value: 'supports_in_place' as const,
    label: 'Supports-in-place status (housing / Medicaid / education / employment plans)',
  },
  {
    value: 'teamky_eligibility' as const,
    label: 'TEAMKY Former Foster Youth Medicaid extension eligibility',
  },
] as const;

export type DcbsDsaScopeValue = (typeof DCBS_DSA_SCOPE_OPTIONS)[number]['value'];

/**
 * OASIS-DSA data classes — the DV-survivor cohort the coalition may receive
 * from OASIS (Owensboro Area Shelter and Information Services). Survivors
 * are not in state custody — abuser-blind redaction at the contract layer
 * is the cornerstone (see ADR 0007).
 *
 * Single source of truth — the intake form renders checkboxes from this
 * array.
 */
export const OASIS_DSA_SCOPE_OPTIONS = [
  {
    value: 'survivor_intake_roster' as const,
    label: 'Survivor intake roster (active enrollments + risk tier)',
  },
  {
    value: 'safety_plan_status' as const,
    label: 'Safety-plan status (on-file flag, last-updated date — never plan content)',
  },
  {
    value: 'service_referral_history' as const,
    label: 'Service-referral history (legal / housing / childcare / employment)',
  },
  {
    value: 'risk_tier_only' as const,
    label: 'Risk tier only (Campbell DA-scale band; aggregate fallback)',
  },
] as const;

export type OasisDsaScopeValue = (typeof OASIS_DSA_SCOPE_OPTIONS)[number]['value'];

/**
 * Abuser-blind redaction-policy fields. Each field is classified as:
 *   - 'share': transmitted as-is to authorized readers
 *   - 'suppress': never transmitted (or transmitted as null) — risk of
 *     abuser obtaining survivor location through a coalition data leak
 *   - 'aggregate_only': only included in aggregate counts, never per-record
 *
 * The set of fields below is the v1 minimum-locked policy. Adding a field
 * later is a contract amendment (ADR 0007 § 3.3).
 */
export const OASIS_REDACTABLE_FIELDS = [
  'current_address',
  'current_employer',
  'child_school_id',
  'risk_tier',
  'enrolled_at',
  'assigned_advocate_id',
] as const;

export type OasisRedactableField = (typeof OASIS_REDACTABLE_FIELDS)[number];
export type OasisRedactionTreatment = 'share' | 'suppress' | 'aggregate_only';
export type OasisRedactionPolicy = Record<OasisRedactableField, OasisRedactionTreatment>;

/**
 * KY DOC DSA data classes — the pre-release cohort the coalition may receive
 * from the Kentucky Department of Corrections to support reentry coordination
 * (SUBP-005). Subjects are in state custody at the time of receipt; the legal
 * authority executing the agreement is KY DOC under KRS Chapter 197 and the
 * Second Chance Act (42 U.S.C. § 17501 et seq.). See ADR 0009.
 *
 * Single source of truth — the intake form renders checkboxes from this array.
 */
export const KY_DOC_DSA_SCOPE_OPTIONS = [
  {
    value: 'pre_release_roster' as const,
    label: 'Pre-release roster (Daviess County residents within the configured window)',
  },
  {
    value: 'release_date_changes' as const,
    label: 'Release-date changes (transfers, parole grants, sentence expirations)',
  },
  {
    value: 'supports_in_place' as const,
    label: 'Supports-in-place (KY DOC pre-release plan: housing / employment / healthcare)',
  },
  {
    value: 'reentry_eligibility' as const,
    label: 'Reentry-program eligibility (housing voucher, Medicaid resumption, treatment programs)',
  },
] as const;

export type KyDocDsaScopeValue = (typeof KY_DOC_DSA_SCOPE_OPTIONS)[number]['value'];

/**
 * Pre-release window bounds. The window is the number of days before
 * projected release that KY DOC may share an individual's record with the
 * Coalition. Below 30 days is operationally too short for housing
 * coordination; above 180 is risk without value (records drift, identifying
 * data sits in the system longer than necessary). See ADR 0009 § Decision.3.
 */
export const KY_DOC_PRE_RELEASE_WINDOW_DEFAULT_DAYS = 60;
export const KY_DOC_PRE_RELEASE_WINDOW_MIN_DAYS = 30;
export const KY_DOC_PRE_RELEASE_WINDOW_MAX_DAYS = 180;

/**
 * Default redaction policy — abuser-blind by default. Locations and
 * identifying details suppressed; risk tier and enrollment date shareable.
 * The intake form starts here; admin may relax fields with explicit
 * justification, but `abuser_blind_attestation` must remain true to record
 * the agreement as `active`.
 */
export const OASIS_DEFAULT_REDACTION_POLICY: OasisRedactionPolicy = {
  current_address: 'suppress',
  current_employer: 'suppress',
  child_school_id: 'suppress',
  risk_tier: 'share',
  enrolled_at: 'share',
  assigned_advocate_id: 'share',
};

// ---------------------------------------------------------------------------
// Terms shapes
// ---------------------------------------------------------------------------

export type FerpaTerms = {
  kind: 'ferpa';
  /** Which data classes are covered by this agreement. */
  scope: FerpaScopeValue[];
  district_name: string;
  liaison_contact: {
    name: string;
    email: string;
    phone?: string;
  };
  /**
   * True when the agreement is structured as a research / studies exception
   * under FERPA § 99.31(a)(6). Must be true for any automated data transfer;
   * false for pure directory-information access.
   */
  studies_exception_invoked: boolean;
  /**
   * When will the district destroy its copy of any data shared with the coalition?
   * Defaults to 'on_termination' per the template.
   */
  data_destruction_due: 'on_termination' | 'after_5_years' | 'never_required';
};

export type MouTerms = {
  kind: 'mou';
  /** Phase classification for this MOU — tracks lifecycle of the partnership. */
  phase: 'phase_0' | 'phase_1' | 'standing';
  /** Monthly coordination meeting commitment (null = no fixed commitment). */
  monthly_meeting_hours: number | null;
  /** Days notice required for withdrawal (default 30 per template). */
  withdrawal_notice_days: number;
};

/**
 * DCBS Data-Sharing Agreement terms (DTRS-011). Authorizes individual-record
 * sharing for the foster aging-out pathway (SUBP-001/002).
 *
 * Distinguished from FERPA (ADR 0005, parental consent → first-initial only)
 * and faith aggregate (ADR 0003, identification-impossible by structure):
 * here the state is the legal guardian, so individual records flow under
 * agency authority. See ADR 0006 for the full privacy contract.
 *
 * `individual_records_authorized` is the runtime gate that downstream
 * SUBP-* features read before ingesting individual youth records.
 */
export type DcbsDsaTerms = {
  kind: 'dsa';
  agency: 'dcbs';
  /** Which data classes are covered by this agreement. */
  scope: DcbsDsaScopeValue[];
  /** Full legal name of the executing agency office (e.g. regional DCBS office). */
  agency_legal_name: string;
  /** Single point of contact at the agency. */
  state_contact: {
    name: string;
    title: string;
    email: string;
    phone?: string;
  };
  /**
   * Population scope of this agreement. Sprint 10 ships `foster_aging_out`
   * only; future amendments may expand.
   */
  population_focus: 'foster_aging_out';
  /**
   * MUST be true for any individual-record ingest. SUBP-001 reads this flag
   * before enabling per-youth views; if false, the agreement is informational
   * only and no individual records may be persisted.
   */
  individual_records_authorized: boolean;
  /**
   * Records-retention deadline. DCBS practice favors `on_termination` or
   * `after_3_years` per the standard state DSA template.
   */
  data_destruction_due: 'on_termination' | 'after_3_years' | 'after_5_years';
};

/**
 * OASIS Data-Sharing Agreement terms (DTRS-012). Authorizes individual-record
 * sharing for the DV survivor pathway (SUBP-004).
 *
 * Distinguished from DCBS (ADR 0006, state-as-guardian custodial authority):
 * OASIS survivors are not in state custody. The contract's privacy guarantee
 * is the abuser-blind redaction policy itself — encoded in the `terms` so
 * SUBP-004's middleware reads it as the single source of truth, not a
 * downstream re-derivation. See ADR 0007 for the full contract.
 *
 * `abuser_blind_attestation` must be true when status='active'. The
 * validator enforces this; `validateAgreementTerms` re-runs it on every
 * insert.
 */
export type OasisDsaTerms = {
  kind: 'dsa';
  agency: 'oasis';
  /** Which data classes are covered by this agreement. */
  scope: OasisDsaScopeValue[];
  /** Full legal name of the executing OASIS entity. */
  agency_legal_name: string;
  /** Single point of contact at OASIS (advocate or program director). */
  agency_contact: {
    name: string;
    title: string;
    email: string;
    phone?: string;
  };
  /**
   * Per-field abuser-blind redaction treatment. Reads:
   *   - `suppress`: SUBP-004 never persists or surfaces this field
   *   - `aggregate_only`: SUBP-004 may include in counts; never per-record
   *   - `share`: transmitted to authorized readers per `data-access.ts`
   *
   * The default policy (`OASIS_DEFAULT_REDACTION_POLICY`) suppresses every
   * field that could leak survivor location.
   */
  redaction_policy: OasisRedactionPolicy;
  /**
   * MUST be true to record this agreement as `status='active'`. The admin
   * checks this box in the intake form after reviewing the redaction
   * policy. Validator throws if the policy is `active` and this flag is
   * not true.
   */
  abuser_blind_attestation: boolean;
  /**
   * Records-retention deadline. KRS 209A confidentiality and DV best
   * practice favor `on_termination` for victim-services data.
   */
  data_destruction_due: 'on_termination' | 'after_3_years' | 'after_5_years';
};

/**
 * KY DOC Data-Sharing Agreement terms (DTRS-013). Authorizes individual-record
 * sharing for the reentry pathway (SUBP-005), bounded by a configurable
 * pre-release window.
 *
 * Distinguished from DCBS (ADR 0006, foster aging-out — same state-as-custodian
 * shape, but no time-bounded window) and OASIS (ADR 0007, voluntary survivor
 * enrollment with abuser-blind redaction): KY DOC subjects are in state custody
 * at the time of receipt, and the cohort is bounded both ways — by Daviess
 * County residency and by the pre-release window. See ADR 0009 for the
 * privacy contract.
 *
 * `individual_records_authorized` is the runtime gate for SUBP-005 (mirrors
 * DCBS pattern). `pre_release_window_days` bounds which records may flow.
 * `no_recidivism_prediction_attestation` MUST be `true` when status='active' —
 * the validator enforces this; the Coalition contractually commits to never
 * use this data for actuarial recidivism scoring.
 */
export type KyDocDsaTerms = {
  kind: 'dsa';
  agency: 'ky_doc';
  /** Which data classes are covered by this agreement. */
  scope: KyDocDsaScopeValue[];
  /** Full legal name of the executing agency office (e.g. "Kentucky Department of Corrections"). */
  agency_legal_name: string;
  /** Single point of contact at KY DOC (reentry coordinator, regional warden, or designee). */
  state_contact: {
    name: string;
    title: string;
    email: string;
    phone?: string;
  };
  /**
   * Population scope of this agreement. Sprint 12 ships `pre_release` only;
   * future amendments may expand to `parole_supervision` or `expungement_support`
   * — each requires a separate ADR.
   */
  population_focus: 'pre_release';
  /**
   * Number of days before projected release that KY DOC may share an
   * individual's record with the Coalition. SUBP-005's ingest middleware
   * reads this as its single source of truth. Bounded by
   * KY_DOC_PRE_RELEASE_WINDOW_MIN_DAYS / KY_DOC_PRE_RELEASE_WINDOW_MAX_DAYS.
   */
  pre_release_window_days: number;
  /**
   * MUST be true for any individual-record ingest. SUBP-005 reads this flag
   * before enabling per-individual views; if false, the agreement is
   * informational only and no individual records may be persisted.
   */
  individual_records_authorized: boolean;
  /**
   * MUST be true to record this agreement as `status='active'`. The admin
   * checks this box in the intake form after reviewing the no-recidivism-
   * prediction commitment. Validator throws if not true.
   */
  no_recidivism_prediction_attestation: boolean;
  /**
   * Records-retention deadline. Reentry best practice favors `on_termination`
   * or `after_3_years` — pre-release records that have outlived the warm-
   * handoff window add risk without operational value.
   */
  data_destruction_due: 'on_termination' | 'after_3_years' | 'after_5_years';
};

/**
 * Union of all DSA-kind terms shapes. The `agency` discriminator is the
 * narrowing key. As of Sprint 12: DCBS (foster), OASIS (DV survivor), and
 * KY DOC (reentry) are fully specified.
 */
export type DsaTerms = DcbsDsaTerms | OasisDsaTerms | KyDocDsaTerms;

/**
 * Placeholder for agreement kinds whose intake stories haven't shipped yet
 * (BAA, QSOA, memo_of_cooperation). Tightened when those stories land.
 */
export type GenericTerms = {
  kind: 'baa' | 'qsoa' | 'memo_of_cooperation';
  [k: string]: unknown;
};

export type PartnerAgreementTerms = FerpaTerms | MouTerms | DsaTerms | GenericTerms;

// ---------------------------------------------------------------------------
// Validators
// ---------------------------------------------------------------------------

const FERPA_SCOPE_VALUES = FERPA_SCOPE_OPTIONS.map((o) => o.value);

/**
 * Validate that `input` conforms to `FerpaTerms`. Throws `Error` on any
 * invalid field; returns a typed `FerpaTerms` on success.
 *
 * Called by `validateAgreementTerms` and directly by the server action
 * before `recordAgreement`.
 */
export function validateFerpaTerms(input: unknown): FerpaTerms {
  if (typeof input !== 'object' || input === null) {
    throw new Error('FERPA terms must be an object');
  }

  // Destructure with a typed assertion — avoids bracket-access lint issues.
  const {
    kind,
    scope,
    district_name,
    liaison_contact,
    studies_exception_invoked,
    data_destruction_due,
  } = input as {
    kind?: unknown;
    scope?: unknown;
    district_name?: unknown;
    liaison_contact?: unknown;
    studies_exception_invoked?: unknown;
    data_destruction_due?: unknown;
  };

  if (kind !== 'ferpa') {
    throw new Error('FERPA terms must have kind: "ferpa"');
  }

  // scope
  if (!Array.isArray(scope) || scope.length === 0) {
    throw new Error('FERPA terms must include at least one scope value');
  }
  for (const s of scope as unknown[]) {
    if (!FERPA_SCOPE_VALUES.includes(s as FerpaScopeValue)) {
      throw new Error(
        `Invalid FERPA scope value: "${String(s)}" (allowed: ${FERPA_SCOPE_VALUES.join(', ')})`,
      );
    }
  }

  // district_name
  if (typeof district_name !== 'string' || !district_name.trim()) {
    throw new Error('FERPA terms must include a non-empty district_name');
  }

  // liaison_contact
  if (typeof liaison_contact !== 'object' || liaison_contact === null) {
    throw new Error('FERPA terms must include a liaison_contact object');
  }
  const {
    name: lcName,
    email: lcEmail,
    phone: lcPhone,
  } = liaison_contact as {
    name?: unknown;
    email?: unknown;
    phone?: unknown;
  };
  if (typeof lcName !== 'string' || !lcName.trim()) {
    throw new Error('FERPA liaison_contact must include a non-empty name');
  }
  if (typeof lcEmail !== 'string' || !lcEmail.trim()) {
    throw new Error('FERPA liaison_contact must include a non-empty email');
  }
  if (lcPhone !== undefined && typeof lcPhone !== 'string') {
    throw new Error('FERPA liaison_contact.phone must be a string when provided');
  }

  // studies_exception_invoked
  if (typeof studies_exception_invoked !== 'boolean') {
    throw new Error('FERPA terms must include studies_exception_invoked (boolean)');
  }

  // data_destruction_due
  const validDestruction = ['on_termination', 'after_5_years', 'never_required'] as const;
  if (!validDestruction.includes(data_destruction_due as (typeof validDestruction)[number])) {
    throw new Error(`FERPA data_destruction_due must be one of: ${validDestruction.join(', ')}`);
  }

  return {
    kind: 'ferpa',
    scope: scope as FerpaScopeValue[],
    district_name,
    liaison_contact: {
      name: lcName,
      email: lcEmail,
      phone: lcPhone as string | undefined,
    },
    studies_exception_invoked,
    data_destruction_due: data_destruction_due as FerpaTerms['data_destruction_due'],
  };
}

/**
 * Validate that `input` conforms to `MouTerms`. Throws on invalid; returns
 * typed value on success.
 */
export function validateMouTerms(input: unknown): MouTerms {
  if (typeof input !== 'object' || input === null) {
    throw new Error('MOU terms must be an object');
  }

  const { kind, phase, monthly_meeting_hours, withdrawal_notice_days } = input as {
    kind?: unknown;
    phase?: unknown;
    monthly_meeting_hours?: unknown;
    withdrawal_notice_days?: unknown;
  };

  if (kind !== 'mou') {
    throw new Error('MOU terms must have kind: "mou"');
  }

  const validPhases = ['phase_0', 'phase_1', 'standing'] as const;
  if (!validPhases.includes(phase as (typeof validPhases)[number])) {
    throw new Error(`MOU terms.phase must be one of: ${validPhases.join(', ')}`);
  }

  if (
    monthly_meeting_hours !== null &&
    (typeof monthly_meeting_hours !== 'number' || monthly_meeting_hours < 0)
  ) {
    throw new Error('MOU terms.monthly_meeting_hours must be a non-negative number or null');
  }

  if (
    typeof withdrawal_notice_days !== 'number' ||
    !Number.isInteger(withdrawal_notice_days) ||
    withdrawal_notice_days < 0
  ) {
    throw new Error('MOU terms.withdrawal_notice_days must be a non-negative integer');
  }

  return {
    kind: 'mou',
    phase: phase as MouTerms['phase'],
    monthly_meeting_hours: monthly_meeting_hours as number | null,
    withdrawal_notice_days,
  };
}

const DCBS_DSA_SCOPE_VALUES = DCBS_DSA_SCOPE_OPTIONS.map((o) => o.value);

/**
 * Validate DCBS-DSA terms (DTRS-011). Throws on invalid; returns typed value
 * on success. See ADR 0006 for the privacy contract this validator enforces.
 */
export function validateDcbsDsaTerms(input: unknown): DcbsDsaTerms {
  if (typeof input !== 'object' || input === null) {
    throw new Error('DSA terms must be an object');
  }

  const {
    kind,
    agency,
    scope,
    agency_legal_name,
    state_contact,
    population_focus,
    individual_records_authorized,
    data_destruction_due,
  } = input as {
    kind?: unknown;
    agency?: unknown;
    scope?: unknown;
    agency_legal_name?: unknown;
    state_contact?: unknown;
    population_focus?: unknown;
    individual_records_authorized?: unknown;
    data_destruction_due?: unknown;
  };

  if (kind !== 'dsa') {
    throw new Error('DSA terms must have kind: "dsa"');
  }
  if (agency !== 'dcbs') {
    throw new Error('DSA terms.agency must be "dcbs" for DCBS agreements');
  }

  // scope
  if (!Array.isArray(scope) || scope.length === 0) {
    throw new Error('DSA terms must include at least one scope value');
  }
  for (const s of scope as unknown[]) {
    if (!DCBS_DSA_SCOPE_VALUES.includes(s as DcbsDsaScopeValue)) {
      throw new Error(
        `Invalid DCBS-DSA scope value: "${String(s)}" (allowed: ${DCBS_DSA_SCOPE_VALUES.join(', ')})`,
      );
    }
  }

  // agency_legal_name
  if (typeof agency_legal_name !== 'string' || !agency_legal_name.trim()) {
    throw new Error('DSA terms must include a non-empty agency_legal_name');
  }

  // state_contact
  if (typeof state_contact !== 'object' || state_contact === null) {
    throw new Error('DSA terms must include a state_contact object');
  }
  const {
    name: scName,
    title: scTitle,
    email: scEmail,
    phone: scPhone,
  } = state_contact as {
    name?: unknown;
    title?: unknown;
    email?: unknown;
    phone?: unknown;
  };
  if (typeof scName !== 'string' || !scName.trim()) {
    throw new Error('DSA state_contact must include a non-empty name');
  }
  if (typeof scTitle !== 'string' || !scTitle.trim()) {
    throw new Error('DSA state_contact must include a non-empty title');
  }
  if (typeof scEmail !== 'string' || !scEmail.trim()) {
    throw new Error('DSA state_contact must include a non-empty email');
  }
  if (scPhone !== undefined && typeof scPhone !== 'string') {
    throw new Error('DSA state_contact.phone must be a string when provided');
  }

  // population_focus
  if (population_focus !== 'foster_aging_out') {
    throw new Error('DSA terms.population_focus must be "foster_aging_out" (Sprint 10 scope)');
  }

  // individual_records_authorized
  if (typeof individual_records_authorized !== 'boolean') {
    throw new Error('DSA terms.individual_records_authorized must be a boolean');
  }

  // data_destruction_due
  const validDestruction = ['on_termination', 'after_3_years', 'after_5_years'] as const;
  if (!validDestruction.includes(data_destruction_due as (typeof validDestruction)[number])) {
    throw new Error(`DSA data_destruction_due must be one of: ${validDestruction.join(', ')}`);
  }

  return {
    kind: 'dsa',
    agency: 'dcbs',
    scope: scope as DcbsDsaScopeValue[],
    agency_legal_name,
    state_contact: {
      name: scName,
      title: scTitle,
      email: scEmail,
      phone: scPhone as string | undefined,
    },
    population_focus: 'foster_aging_out',
    individual_records_authorized,
    data_destruction_due: data_destruction_due as DcbsDsaTerms['data_destruction_due'],
  };
}

const OASIS_DSA_SCOPE_VALUES = OASIS_DSA_SCOPE_OPTIONS.map((o) => o.value);
const OASIS_REDACTION_TREATMENTS: readonly OasisRedactionTreatment[] = [
  'share',
  'suppress',
  'aggregate_only',
];

/**
 * Validate OASIS-DSA terms (DTRS-012). Throws on invalid; returns typed value
 * on success. See ADR 0007 for the privacy contract this validator enforces.
 *
 * **Strict abuser-blind enforcement:** `abuser_blind_attestation` MUST be
 * `true`. Recording an OASIS-DSA without attestation is an architectural
 * bug — the abuser-blind discipline is the contract, not an option. If a
 * draft path is ever needed, revisit with an explicit `status` parameter
 * here rather than weakening the validator (ADR 0007 § 3.3).
 *
 * The redaction policy must cover every field in `OASIS_REDACTABLE_FIELDS` —
 * partial policies are rejected, since SUBP-004's middleware reads this as
 * its single source of truth and a missing field would silently fall through
 * to "share." Adding a field to the policy is a contract amendment.
 */
export function validateOasisDsaTerms(input: unknown): OasisDsaTerms {
  if (typeof input !== 'object' || input === null) {
    throw new Error('DSA terms must be an object');
  }

  const {
    kind,
    agency,
    scope,
    agency_legal_name,
    agency_contact,
    redaction_policy,
    abuser_blind_attestation,
    data_destruction_due,
  } = input as {
    kind?: unknown;
    agency?: unknown;
    scope?: unknown;
    agency_legal_name?: unknown;
    agency_contact?: unknown;
    redaction_policy?: unknown;
    abuser_blind_attestation?: unknown;
    data_destruction_due?: unknown;
  };

  if (kind !== 'dsa') {
    throw new Error('DSA terms must have kind: "dsa"');
  }
  if (agency !== 'oasis') {
    throw new Error('DSA terms.agency must be "oasis" for OASIS agreements');
  }

  if (!Array.isArray(scope) || scope.length === 0) {
    throw new Error('DSA terms must include at least one scope value');
  }
  for (const s of scope as unknown[]) {
    if (!OASIS_DSA_SCOPE_VALUES.includes(s as OasisDsaScopeValue)) {
      throw new Error(
        `Invalid OASIS-DSA scope value: "${String(s)}" (allowed: ${OASIS_DSA_SCOPE_VALUES.join(', ')})`,
      );
    }
  }

  if (typeof agency_legal_name !== 'string' || !agency_legal_name.trim()) {
    throw new Error('DSA terms must include a non-empty agency_legal_name');
  }

  if (typeof agency_contact !== 'object' || agency_contact === null) {
    throw new Error('DSA terms must include an agency_contact object');
  }
  const {
    name: acName,
    title: acTitle,
    email: acEmail,
    phone: acPhone,
  } = agency_contact as {
    name?: unknown;
    title?: unknown;
    email?: unknown;
    phone?: unknown;
  };
  if (typeof acName !== 'string' || !acName.trim()) {
    throw new Error('DSA agency_contact must include a non-empty name');
  }
  if (typeof acTitle !== 'string' || !acTitle.trim()) {
    throw new Error('DSA agency_contact must include a non-empty title');
  }
  if (typeof acEmail !== 'string' || !acEmail.trim()) {
    throw new Error('DSA agency_contact must include a non-empty email');
  }
  if (acPhone !== undefined && typeof acPhone !== 'string') {
    throw new Error('DSA agency_contact.phone must be a string when provided');
  }

  if (typeof redaction_policy !== 'object' || redaction_policy === null) {
    throw new Error('DSA terms must include a redaction_policy object');
  }
  const policyEntries = redaction_policy as Record<string, unknown>;
  const validatedPolicy: Partial<OasisRedactionPolicy> = {};
  for (const field of OASIS_REDACTABLE_FIELDS) {
    const treatment = policyEntries[field];
    if (
      typeof treatment !== 'string' ||
      !OASIS_REDACTION_TREATMENTS.includes(treatment as OasisRedactionTreatment)
    ) {
      throw new Error(
        `Invalid OASIS-DSA redaction_policy["${field}"]: must be one of ${OASIS_REDACTION_TREATMENTS.join(', ')}`,
      );
    }
    validatedPolicy[field] = treatment as OasisRedactionTreatment;
  }

  if (abuser_blind_attestation !== true) {
    throw new Error(
      'DSA terms.abuser_blind_attestation must be true — abuser-blind discipline is the OASIS contract (ADR 0007). ' +
        'Recording without attestation is not permitted.',
    );
  }

  const validDestruction = ['on_termination', 'after_3_years', 'after_5_years'] as const;
  if (!validDestruction.includes(data_destruction_due as (typeof validDestruction)[number])) {
    throw new Error(`DSA data_destruction_due must be one of: ${validDestruction.join(', ')}`);
  }

  return {
    kind: 'dsa',
    agency: 'oasis',
    scope: scope as OasisDsaScopeValue[],
    agency_legal_name,
    agency_contact: {
      name: acName,
      title: acTitle,
      email: acEmail,
      phone: acPhone as string | undefined,
    },
    redaction_policy: validatedPolicy as OasisRedactionPolicy,
    abuser_blind_attestation: true,
    data_destruction_due: data_destruction_due as OasisDsaTerms['data_destruction_due'],
  };
}

const KY_DOC_DSA_SCOPE_VALUES = KY_DOC_DSA_SCOPE_OPTIONS.map((o) => o.value);

/**
 * Validate KY DOC-DSA terms (DTRS-013). Throws on invalid; returns typed
 * value on success. See ADR 0009 for the privacy contract this validator
 * enforces.
 *
 * **Strict no-recidivism-prediction enforcement:**
 * `no_recidivism_prediction_attestation` MUST be `true`. Recording a KY DOC
 * DSA without it is an architectural bug — the prohibition is the contract,
 * not an option. If a future research / IRB-supervised study needs different
 * terms, that gets a separate agreement and a separate ADR.
 *
 * **Pre-release window bounds:** `pre_release_window_days` must fall within
 * `[KY_DOC_PRE_RELEASE_WINDOW_MIN_DAYS, KY_DOC_PRE_RELEASE_WINDOW_MAX_DAYS]`.
 * SUBP-005's ingest middleware reads this as its single source of truth.
 */
export function validateKyDocDsaTerms(input: unknown): KyDocDsaTerms {
  if (typeof input !== 'object' || input === null) {
    throw new Error('DSA terms must be an object');
  }

  const {
    kind,
    agency,
    scope,
    agency_legal_name,
    state_contact,
    population_focus,
    pre_release_window_days,
    individual_records_authorized,
    no_recidivism_prediction_attestation,
    data_destruction_due,
  } = input as {
    kind?: unknown;
    agency?: unknown;
    scope?: unknown;
    agency_legal_name?: unknown;
    state_contact?: unknown;
    population_focus?: unknown;
    pre_release_window_days?: unknown;
    individual_records_authorized?: unknown;
    no_recidivism_prediction_attestation?: unknown;
    data_destruction_due?: unknown;
  };

  if (kind !== 'dsa') {
    throw new Error('DSA terms must have kind: "dsa"');
  }
  if (agency !== 'ky_doc') {
    throw new Error('DSA terms.agency must be "ky_doc" for KY DOC agreements');
  }

  if (!Array.isArray(scope) || scope.length === 0) {
    throw new Error('DSA terms must include at least one scope value');
  }
  for (const s of scope as unknown[]) {
    if (!KY_DOC_DSA_SCOPE_VALUES.includes(s as KyDocDsaScopeValue)) {
      throw new Error(
        `Invalid KY-DOC-DSA scope value: "${String(s)}" (allowed: ${KY_DOC_DSA_SCOPE_VALUES.join(', ')})`,
      );
    }
  }

  if (typeof agency_legal_name !== 'string' || !agency_legal_name.trim()) {
    throw new Error('DSA terms must include a non-empty agency_legal_name');
  }

  if (typeof state_contact !== 'object' || state_contact === null) {
    throw new Error('DSA terms must include a state_contact object');
  }
  const {
    name: scName,
    title: scTitle,
    email: scEmail,
    phone: scPhone,
  } = state_contact as {
    name?: unknown;
    title?: unknown;
    email?: unknown;
    phone?: unknown;
  };
  if (typeof scName !== 'string' || !scName.trim()) {
    throw new Error('DSA state_contact must include a non-empty name');
  }
  if (typeof scTitle !== 'string' || !scTitle.trim()) {
    throw new Error('DSA state_contact must include a non-empty title');
  }
  if (typeof scEmail !== 'string' || !scEmail.trim()) {
    throw new Error('DSA state_contact must include a non-empty email');
  }
  if (scPhone !== undefined && typeof scPhone !== 'string') {
    throw new Error('DSA state_contact.phone must be a string when provided');
  }

  if (population_focus !== 'pre_release') {
    throw new Error('DSA terms.population_focus must be "pre_release" (Sprint 12 scope)');
  }

  if (
    typeof pre_release_window_days !== 'number' ||
    !Number.isInteger(pre_release_window_days) ||
    pre_release_window_days < KY_DOC_PRE_RELEASE_WINDOW_MIN_DAYS ||
    pre_release_window_days > KY_DOC_PRE_RELEASE_WINDOW_MAX_DAYS
  ) {
    throw new Error(
      `DSA terms.pre_release_window_days must be an integer in ` +
        `[${KY_DOC_PRE_RELEASE_WINDOW_MIN_DAYS}, ${KY_DOC_PRE_RELEASE_WINDOW_MAX_DAYS}] ` +
        `(see ADR 0009 § Decision.3)`,
    );
  }

  if (typeof individual_records_authorized !== 'boolean') {
    throw new Error('DSA terms.individual_records_authorized must be a boolean');
  }

  if (no_recidivism_prediction_attestation !== true) {
    throw new Error(
      'DSA terms.no_recidivism_prediction_attestation must be true — the no-recidivism-prediction ' +
        'commitment is the KY DOC contract (ADR 0009). Recording without attestation is not permitted.',
    );
  }

  const validDestruction = ['on_termination', 'after_3_years', 'after_5_years'] as const;
  if (!validDestruction.includes(data_destruction_due as (typeof validDestruction)[number])) {
    throw new Error(`DSA data_destruction_due must be one of: ${validDestruction.join(', ')}`);
  }

  return {
    kind: 'dsa',
    agency: 'ky_doc',
    scope: scope as KyDocDsaScopeValue[],
    agency_legal_name,
    state_contact: {
      name: scName,
      title: scTitle,
      email: scEmail,
      phone: scPhone as string | undefined,
    },
    population_focus: 'pre_release',
    pre_release_window_days,
    individual_records_authorized,
    no_recidivism_prediction_attestation: true,
    data_destruction_due: data_destruction_due as KyDocDsaTerms['data_destruction_due'],
  };
}

/**
 * Dispatcher — picks the right validator for the given agreement kind.
 *
 * Placeholder kinds (baa, qsoa, memo_of_cooperation) are intentionally
 * fail-closed: they throw until their intake stories ship and a real validator
 * is wired in. `dsa` is dispatched on the `agency` discriminator: `dcbs`
 * (DTRS-011), `oasis` (DTRS-012), and `ky_doc` (DTRS-013) are supported.
 * See ADR 0004 for the registry plan.
 */
export function validateAgreementTerms(
  kind: PartnerAgreementKind,
  input: unknown,
): PartnerAgreementTerms {
  switch (kind) {
    case 'ferpa':
      return validateFerpaTerms(input);
    case 'mou':
      return validateMouTerms(input);
    case 'dsa': {
      if (typeof input !== 'object' || input === null) {
        throw new Error('DSA terms must be an object');
      }
      const agency = (input as { agency?: unknown }).agency;
      if (agency === 'dcbs') return validateDcbsDsaTerms(input);
      if (agency === 'oasis') return validateOasisDsaTerms(input);
      if (agency === 'ky_doc') return validateKyDocDsaTerms(input);
      if (typeof agency !== 'string' || !agency) {
        throw new Error("DSA terms.agency is required (e.g. 'dcbs', 'oasis', 'ky_doc')");
      }
      throw new Error(
        `DSA agency '${agency}' not yet supported — its intake story has not shipped. ` +
          'See ADR 0004 for the registry plan.',
      );
    }
    case 'baa':
    case 'qsoa':
    case 'memo_of_cooperation':
      throw new Error(
        `agreement kind '${kind}' not yet supported — its intake story has not shipped. ` +
          'See ADR 0004 for the registry plan.',
      );
    default: {
      // Exhaustiveness guard for future enum values added before validators are updated.
      const _exhaustive: never = kind;
      throw new Error(`No validator for agreement kind: ${String(_exhaustive)}`);
    }
  }
}
