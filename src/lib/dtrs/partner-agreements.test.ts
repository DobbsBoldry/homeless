import { describe, expect, it } from 'vitest';
import {
  FERPA_SCOPE_OPTIONS,
  validateAgreementTerms,
  validateFerpaTerms,
  validateMouTerms,
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

  it('throws for placeholder kind dsa (intake story not yet shipped)', () => {
    expect(() => validateAgreementTerms('dsa', { kind: 'dsa' })).toThrow(
      "agreement kind 'dsa' not yet supported",
    );
  });

  it('throws for placeholder kind memo_of_cooperation (intake story not yet shipped)', () => {
    expect(() => validateAgreementTerms('memo_of_cooperation', {})).toThrow(
      "agreement kind 'memo_of_cooperation' not yet supported",
    );
  });
});
