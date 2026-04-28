/**
 * Partner-agreements domain logic — DTRS-010.
 *
 * Discriminated-union types for the `terms` JSONB column in
 * `partner_agreements`. Each agreement kind owns its terms shape; only
 * `ferpa` and `mou` are fully specified for Sprint 9. The remaining kinds
 * carry a permissive placeholder until their stories ship.
 *
 * Validators (`validateFerpaTerms`, `validateMouTerms`, `validateAgreementTerms`)
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
 * Placeholder for agreement kinds whose intake stories haven't shipped yet
 * (BAA, QSOA, DSA, memo_of_cooperation). Tightened when those stories land.
 */
export type GenericTerms = {
  kind: 'baa' | 'qsoa' | 'dsa' | 'memo_of_cooperation';
  [k: string]: unknown;
};

export type PartnerAgreementTerms = FerpaTerms | MouTerms | GenericTerms;

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

/**
 * Dispatcher — picks the right validator for the given agreement kind.
 *
 * Placeholder kinds (baa, qsoa, dsa, memo_of_cooperation) are intentionally
 * fail-closed: they throw until their intake stories ship and a real validator
 * is wired in. This prevents non-FERPA writes from silently accepting arbitrary
 * data before the intake forms are ready. See ADR 0004 for the registry plan.
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
    case 'baa':
    case 'qsoa':
    case 'dsa':
    case 'memo_of_cooperation':
      throw new Error(
        `agreement kind '${kind}' not yet supported — its intake story has not shipped. ` +
          `See ADR 0004 for the registry plan.`,
      );
    default: {
      // Exhaustiveness guard for future enum values added before validators are updated.
      const _exhaustive: never = kind;
      throw new Error(`No validator for agreement kind: ${String(_exhaustive)}`);
    }
  }
}
