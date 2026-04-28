import { describe, expect, it } from 'vitest';
import {
  DCBS_DSA_SCOPE_OPTIONS,
  FERPA_SCOPE_OPTIONS,
  OASIS_DEFAULT_REDACTION_POLICY,
  OASIS_DSA_SCOPE_OPTIONS,
  validateAgreementTerms,
  validateDcbsDsaTerms,
  validateFerpaTerms,
  validateMouTerms,
  validateOasisDsaTerms,
} from './partner-agreements';

// ---------------------------------------------------------------------------
// validateFerpaTerms
// ---------------------------------------------------------------------------

const validFerpa = {
  kind: 'ferpa',
  scope: ['attendance_patterns', 'mckinney_vento_ids'],
  district_name: 'Daviess County Public Schools',
  liaison_contact: {
    name: 'Jane Smith',
    email: 'jsmith@daviess.kyschools.us',
    phone: '(270) 852-7000',
  },
  studies_exception_invoked: true,
  data_destruction_due: 'on_termination',
};

describe('validateFerpaTerms', () => {
  it('accepts a valid FERPA terms object', () => {
    const result = validateFerpaTerms(validFerpa);
    expect(result.kind).toBe('ferpa');
    expect(result.district_name).toBe('Daviess County Public Schools');
    expect(result.scope).toEqual(['attendance_patterns', 'mckinney_vento_ids']);
    expect(result.studies_exception_invoked).toBe(true);
    expect(result.data_destruction_due).toBe('on_termination');
  });

  it('accepts all valid scope values', () => {
    const allScopes = FERPA_SCOPE_OPTIONS.map((o) => o.value);
    const result = validateFerpaTerms({ ...validFerpa, scope: allScopes });
    expect(result.scope).toEqual(allScopes);
  });

  it('accepts terms without optional phone', () => {
    const noPhone = {
      ...validFerpa,
      liaison_contact: { name: 'Jane Smith', email: 'j@example.com' },
    };
    const result = validateFerpaTerms(noPhone);
    expect(result.liaison_contact.phone).toBeUndefined();
  });

  it('accepts all valid data_destruction_due values', () => {
    for (const val of ['on_termination', 'after_5_years', 'never_required'] as const) {
      const result = validateFerpaTerms({ ...validFerpa, data_destruction_due: val });
      expect(result.data_destruction_due).toBe(val);
    }
  });

  it('rejects non-object input', () => {
    expect(() => validateFerpaTerms(null)).toThrow('must be an object');
    expect(() => validateFerpaTerms('ferpa')).toThrow('must be an object');
    expect(() => validateFerpaTerms(42)).toThrow('must be an object');
  });

  it('rejects wrong kind', () => {
    expect(() => validateFerpaTerms({ ...validFerpa, kind: 'mou' })).toThrow('kind: "ferpa"');
  });

  it('rejects empty scope array', () => {
    expect(() => validateFerpaTerms({ ...validFerpa, scope: [] })).toThrow(
      'at least one scope value',
    );
  });

  it('rejects an invalid scope value', () => {
    expect(() =>
      validateFerpaTerms({ ...validFerpa, scope: ['attendance_patterns', 'gpa_records'] }),
    ).toThrow('Invalid FERPA scope value: "gpa_records"');
  });

  it('rejects missing district_name', () => {
    expect(() => validateFerpaTerms({ ...validFerpa, district_name: '' })).toThrow(
      'non-empty district_name',
    );
    expect(() => validateFerpaTerms({ ...validFerpa, district_name: '   ' })).toThrow(
      'non-empty district_name',
    );
  });

  it('rejects missing liaison_contact name', () => {
    expect(() =>
      validateFerpaTerms({
        ...validFerpa,
        liaison_contact: { name: '', email: 'j@x.com' },
      }),
    ).toThrow('non-empty name');
  });

  it('rejects missing liaison_contact email', () => {
    expect(() =>
      validateFerpaTerms({
        ...validFerpa,
        liaison_contact: { name: 'Jane', email: '' },
      }),
    ).toThrow('non-empty email');
  });

  it('rejects non-boolean studies_exception_invoked', () => {
    expect(() => validateFerpaTerms({ ...validFerpa, studies_exception_invoked: 'yes' })).toThrow(
      'studies_exception_invoked (boolean)',
    );
  });

  it('rejects an invalid data_destruction_due value', () => {
    expect(() =>
      validateFerpaTerms({ ...validFerpa, data_destruction_due: 'immediately' }),
    ).toThrow('data_destruction_due must be one of');
  });
});

// ---------------------------------------------------------------------------
// validateMouTerms
// ---------------------------------------------------------------------------

const validMou = {
  kind: 'mou',
  phase: 'phase_0',
  monthly_meeting_hours: 2,
  withdrawal_notice_days: 30,
};

describe('validateMouTerms', () => {
  it('accepts a valid MOU terms object', () => {
    const result = validateMouTerms(validMou);
    expect(result.kind).toBe('mou');
    expect(result.phase).toBe('phase_0');
    expect(result.monthly_meeting_hours).toBe(2);
    expect(result.withdrawal_notice_days).toBe(30);
  });

  it('accepts null monthly_meeting_hours (no fixed commitment)', () => {
    const result = validateMouTerms({ ...validMou, monthly_meeting_hours: null });
    expect(result.monthly_meeting_hours).toBeNull();
  });

  it('accepts all valid phase values', () => {
    for (const phase of ['phase_0', 'phase_1', 'standing'] as const) {
      const result = validateMouTerms({ ...validMou, phase });
      expect(result.phase).toBe(phase);
    }
  });

  it('rejects non-object input', () => {
    expect(() => validateMouTerms(null)).toThrow('must be an object');
    expect(() => validateMouTerms('mou')).toThrow('must be an object');
  });

  it('rejects wrong kind', () => {
    expect(() => validateMouTerms({ ...validMou, kind: 'ferpa' })).toThrow('kind: "mou"');
  });

  it('rejects invalid phase value', () => {
    expect(() => validateMouTerms({ ...validMou, phase: 'phase_99' })).toThrow(
      'terms.phase must be one of',
    );
  });

  it('rejects negative monthly_meeting_hours', () => {
    expect(() => validateMouTerms({ ...validMou, monthly_meeting_hours: -1 })).toThrow(
      'non-negative number or null',
    );
  });

  it('rejects non-integer withdrawal_notice_days', () => {
    expect(() => validateMouTerms({ ...validMou, withdrawal_notice_days: 30.5 })).toThrow(
      'non-negative integer',
    );
  });

  it('rejects negative withdrawal_notice_days', () => {
    expect(() => validateMouTerms({ ...validMou, withdrawal_notice_days: -1 })).toThrow(
      'non-negative integer',
    );
  });

  it('rejects missing withdrawal_notice_days', () => {
    const { withdrawal_notice_days: _, ...noWithdrawal } = validMou;
    expect(() => validateMouTerms(noWithdrawal)).toThrow('non-negative integer');
  });
});

// ---------------------------------------------------------------------------
// validateDcbsDsaTerms (DTRS-011)
// ---------------------------------------------------------------------------

const validDcbsDsa = {
  kind: 'dsa',
  agency: 'dcbs',
  scope: ['foster_aging_out_roster', 'placement_history'],
  agency_legal_name:
    'Kentucky Cabinet for Health and Family Services, Department for Community Based Services',
  state_contact: {
    name: 'Robin Davis',
    title: 'Service Region Administrator',
    email: 'robin.davis@ky.gov',
    phone: '(502) 564-0000',
  },
  population_focus: 'foster_aging_out',
  individual_records_authorized: true,
  data_destruction_due: 'on_termination',
};

describe('validateDcbsDsaTerms', () => {
  it('accepts a valid DCBS DSA terms object', () => {
    const result = validateDcbsDsaTerms(validDcbsDsa);
    expect(result.kind).toBe('dsa');
    expect(result.agency).toBe('dcbs');
    expect(result.scope).toEqual(['foster_aging_out_roster', 'placement_history']);
    expect(result.population_focus).toBe('foster_aging_out');
    expect(result.individual_records_authorized).toBe(true);
    expect(result.data_destruction_due).toBe('on_termination');
  });

  it('accepts all valid scope values', () => {
    const allScopes = DCBS_DSA_SCOPE_OPTIONS.map((o) => o.value);
    const result = validateDcbsDsaTerms({ ...validDcbsDsa, scope: allScopes });
    expect(result.scope).toEqual(allScopes);
  });

  it('accepts all valid data_destruction_due values', () => {
    for (const val of ['on_termination', 'after_3_years', 'after_5_years'] as const) {
      const result = validateDcbsDsaTerms({ ...validDcbsDsa, data_destruction_due: val });
      expect(result.data_destruction_due).toBe(val);
    }
  });

  it('accepts terms without optional phone', () => {
    const noPhone = {
      ...validDcbsDsa,
      state_contact: {
        name: 'R',
        title: 'T',
        email: 'r@x.com',
      },
    };
    const result = validateDcbsDsaTerms(noPhone);
    expect(result.state_contact.phone).toBeUndefined();
  });

  it('rejects non-object input', () => {
    expect(() => validateDcbsDsaTerms(null)).toThrow('must be an object');
    expect(() => validateDcbsDsaTerms('dsa')).toThrow('must be an object');
  });

  it('rejects wrong kind', () => {
    expect(() => validateDcbsDsaTerms({ ...validDcbsDsa, kind: 'mou' })).toThrow('kind: "dsa"');
  });

  it('rejects wrong agency', () => {
    expect(() => validateDcbsDsaTerms({ ...validDcbsDsa, agency: 'ky_doc' })).toThrow(
      'agency must be "dcbs"',
    );
  });

  it('rejects empty scope array', () => {
    expect(() => validateDcbsDsaTerms({ ...validDcbsDsa, scope: [] })).toThrow(
      'at least one scope value',
    );
  });

  it('rejects invalid scope value', () => {
    expect(() =>
      validateDcbsDsaTerms({ ...validDcbsDsa, scope: ['mental_health_records'] }),
    ).toThrow('Invalid DCBS-DSA scope value: "mental_health_records"');
  });

  it('rejects empty agency_legal_name', () => {
    expect(() => validateDcbsDsaTerms({ ...validDcbsDsa, agency_legal_name: '' })).toThrow(
      'non-empty agency_legal_name',
    );
  });

  it('rejects missing state_contact name', () => {
    expect(() =>
      validateDcbsDsaTerms({
        ...validDcbsDsa,
        state_contact: { name: '', title: 'T', email: 'r@x.com' },
      }),
    ).toThrow('non-empty name');
  });

  it('rejects missing state_contact title', () => {
    expect(() =>
      validateDcbsDsaTerms({
        ...validDcbsDsa,
        state_contact: { name: 'R', title: '', email: 'r@x.com' },
      }),
    ).toThrow('non-empty title');
  });

  it('rejects missing state_contact email', () => {
    expect(() =>
      validateDcbsDsaTerms({
        ...validDcbsDsa,
        state_contact: { name: 'R', title: 'T', email: '' },
      }),
    ).toThrow('non-empty email');
  });

  it('rejects expanded population_focus (Sprint 10 lock)', () => {
    expect(() =>
      validateDcbsDsaTerms({ ...validDcbsDsa, population_focus: 'all_open_cases' }),
    ).toThrow('population_focus must be "foster_aging_out"');
  });

  it('rejects non-boolean individual_records_authorized', () => {
    expect(() =>
      validateDcbsDsaTerms({ ...validDcbsDsa, individual_records_authorized: 'yes' }),
    ).toThrow('individual_records_authorized must be a boolean');
  });

  it('rejects invalid data_destruction_due', () => {
    expect(() =>
      validateDcbsDsaTerms({ ...validDcbsDsa, data_destruction_due: 'never_required' }),
    ).toThrow('data_destruction_due must be one of');
  });

  it('strips extra/unexpected keys (does not pass through to JSONB)', () => {
    const result = validateDcbsDsaTerms({
      ...validDcbsDsa,
      malicious_extra_field: 'should not survive',
    });
    expect(result).not.toHaveProperty('malicious_extra_field');
  });
});

// ---------------------------------------------------------------------------
// validateAgreementTerms dispatcher
// ---------------------------------------------------------------------------

describe('validateAgreementTerms', () => {
  it('dispatches ferpa to validateFerpaTerms', () => {
    const result = validateAgreementTerms('ferpa', validFerpa);
    expect(result.kind).toBe('ferpa');
  });

  it('dispatches mou to validateMouTerms', () => {
    const result = validateAgreementTerms('mou', validMou);
    expect(result.kind).toBe('mou');
  });

  it("dispatches dsa+agency='dcbs' to validateDcbsDsaTerms", () => {
    const result = validateAgreementTerms('dsa', validDcbsDsa);
    expect(result.kind).toBe('dsa');
    if (result.kind === 'dsa') expect(result.agency).toBe('dcbs');
  });

  it('rejects dsa with missing agency discriminator', () => {
    expect(() => validateAgreementTerms('dsa', { kind: 'dsa', scope: [] })).toThrow(
      'agency is required',
    );
  });

  it("rejects dsa with agency='ky_doc' (DTRS-012 not yet shipped)", () => {
    expect(() =>
      validateAgreementTerms('dsa', { kind: 'dsa', agency: 'ky_doc', scope: [] }),
    ).toThrow("DSA agency 'ky_doc' not yet supported");
  });

  it('rejects dsa with non-object input', () => {
    expect(() => validateAgreementTerms('dsa', null)).toThrow('must be an object');
  });

  it('throws for placeholder kind baa (intake story not yet shipped)', () => {
    expect(() => validateAgreementTerms('baa', { kind: 'baa', foo: 'bar' })).toThrow(
      "agreement kind 'baa' not yet supported",
    );
  });

  it('throws for placeholder kind qsoa (intake story not yet shipped)', () => {
    expect(() => validateAgreementTerms('qsoa', { kind: 'qsoa' })).toThrow(
      "agreement kind 'qsoa' not yet supported",
    );
  });

  it('throws for placeholder kind memo_of_cooperation (intake story not yet shipped)', () => {
    expect(() => validateAgreementTerms('memo_of_cooperation', {})).toThrow(
      "agreement kind 'memo_of_cooperation' not yet supported",
    );
  });

  it("dispatches dsa+agency='oasis' to validateOasisDsaTerms", () => {
    const result = validateAgreementTerms('dsa', validOasisDsa);
    expect(result.kind).toBe('dsa');
    if (result.kind === 'dsa') expect(result.agency).toBe('oasis');
  });
});

// ---------------------------------------------------------------------------
// validateOasisDsaTerms (DTRS-012)
// ---------------------------------------------------------------------------

const validOasisDsa = {
  kind: 'dsa',
  agency: 'oasis',
  scope: ['survivor_intake_roster', 'safety_plan_status'],
  agency_legal_name: 'Owensboro Area Shelter and Information Services, Inc.',
  agency_contact: {
    name: 'Avery Hart',
    title: 'Executive Director',
    email: 'avery.hart@oasisshelter.org',
    phone: '(270) 685-0260',
  },
  redaction_policy: OASIS_DEFAULT_REDACTION_POLICY,
  abuser_blind_attestation: true,
  data_destruction_due: 'on_termination',
};

describe('validateOasisDsaTerms', () => {
  it('accepts a valid OASIS DSA terms object', () => {
    const result = validateOasisDsaTerms(validOasisDsa);
    expect(result.kind).toBe('dsa');
    expect(result.agency).toBe('oasis');
    expect(result.scope).toEqual(['survivor_intake_roster', 'safety_plan_status']);
    expect(result.abuser_blind_attestation).toBe(true);
    expect(result.redaction_policy.current_address).toBe('suppress');
  });

  it('accepts all valid scope values', () => {
    const allScopes = OASIS_DSA_SCOPE_OPTIONS.map((o) => o.value);
    const result = validateOasisDsaTerms({ ...validOasisDsa, scope: allScopes });
    expect(result.scope).toEqual(allScopes);
  });

  it('accepts all valid data_destruction_due values', () => {
    for (const val of ['on_termination', 'after_3_years', 'after_5_years'] as const) {
      const result = validateOasisDsaTerms({ ...validOasisDsa, data_destruction_due: val });
      expect(result.data_destruction_due).toBe(val);
    }
  });

  it('accepts a relaxed redaction policy when admin opts in (still abuser-blind via attestation)', () => {
    const relaxed = {
      ...validOasisDsa,
      redaction_policy: {
        ...OASIS_DEFAULT_REDACTION_POLICY,
        risk_tier: 'aggregate_only' as const,
      },
    };
    const result = validateOasisDsaTerms(relaxed);
    expect(result.redaction_policy.risk_tier).toBe('aggregate_only');
  });

  it('accepts terms without optional phone', () => {
    const noPhone = {
      ...validOasisDsa,
      agency_contact: { name: 'A', title: 'T', email: 'a@x.com' },
    };
    const result = validateOasisDsaTerms(noPhone);
    expect(result.agency_contact.phone).toBeUndefined();
  });

  it('rejects non-object input', () => {
    expect(() => validateOasisDsaTerms(null)).toThrow('must be an object');
    expect(() => validateOasisDsaTerms('dsa')).toThrow('must be an object');
  });

  it('rejects wrong kind', () => {
    expect(() => validateOasisDsaTerms({ ...validOasisDsa, kind: 'mou' })).toThrow('kind: "dsa"');
  });

  it('rejects wrong agency', () => {
    expect(() => validateOasisDsaTerms({ ...validOasisDsa, agency: 'dcbs' })).toThrow(
      'agency must be "oasis"',
    );
  });

  it('rejects empty scope array', () => {
    expect(() => validateOasisDsaTerms({ ...validOasisDsa, scope: [] })).toThrow(
      'at least one scope value',
    );
  });

  it('rejects invalid scope value', () => {
    expect(() => validateOasisDsaTerms({ ...validOasisDsa, scope: ['gps_pings'] })).toThrow(
      'Invalid OASIS-DSA scope value: "gps_pings"',
    );
  });

  it('rejects empty agency_legal_name', () => {
    expect(() => validateOasisDsaTerms({ ...validOasisDsa, agency_legal_name: '' })).toThrow(
      'non-empty agency_legal_name',
    );
  });

  it('rejects missing agency_contact name', () => {
    expect(() =>
      validateOasisDsaTerms({
        ...validOasisDsa,
        agency_contact: { name: '', title: 'T', email: 'a@x.com' },
      }),
    ).toThrow('non-empty name');
  });

  it('rejects abuser_blind_attestation = false (the cornerstone of the contract)', () => {
    expect(() =>
      validateOasisDsaTerms({ ...validOasisDsa, abuser_blind_attestation: false }),
    ).toThrow('abuser_blind_attestation must be true');
  });

  it('rejects abuser_blind_attestation missing entirely', () => {
    const { abuser_blind_attestation: _omit, ...withoutAttestation } = validOasisDsa;
    void _omit;
    expect(() => validateOasisDsaTerms(withoutAttestation)).toThrow(
      'abuser_blind_attestation must be true',
    );
  });

  it('rejects redaction_policy missing a required field', () => {
    const { current_address: _drop, ...partialPolicy } = OASIS_DEFAULT_REDACTION_POLICY;
    void _drop;
    expect(() =>
      validateOasisDsaTerms({ ...validOasisDsa, redaction_policy: partialPolicy }),
    ).toThrow('redaction_policy["current_address"]');
  });

  it('rejects redaction_policy with an invalid treatment value', () => {
    expect(() =>
      validateOasisDsaTerms({
        ...validOasisDsa,
        redaction_policy: { ...OASIS_DEFAULT_REDACTION_POLICY, current_address: 'show_to_all' },
      }),
    ).toThrow('redaction_policy["current_address"]');
  });

  it('rejects invalid data_destruction_due', () => {
    expect(() =>
      validateOasisDsaTerms({ ...validOasisDsa, data_destruction_due: 'never_required' }),
    ).toThrow('data_destruction_due must be one of');
  });

  it('strips extra/unexpected keys (does not pass through to JSONB)', () => {
    const result = validateOasisDsaTerms({
      ...validOasisDsa,
      survivor_home_address: '123 Real St',
    });
    expect(result).not.toHaveProperty('survivor_home_address');
  });
});
