/**
 * Unit tests for `parsePartnerAgreementForm` — the pure FormData parser
 * for the DTRS-010 FERPA agreement intake form.
 *
 * Tests the pure parsing function directly — no auth or DB mocking required.
 * See STATE.md known quirk: Next.js 'use server' × vitest incompatibility.
 */
import { describe, expect, it } from 'vitest';
import { parseDcbsDsaAgreementForm, parsePartnerAgreementForm } from './partner-agreements-parse';

function makeFormData(overrides: Record<string, string> = {}): FormData {
  const fd = new FormData();
  fd.set('partnerOrgId', 'school-uuid-001');
  fd.set('effectiveDate', '2026-08-01');
  fd.set('district_name', 'Daviess County Public Schools');
  fd.set('liaison_name', 'Jane Smith');
  fd.set('liaison_email', 'jsmith@daviess.kyschools.us');
  fd.set('scope_attendance_patterns', 'on');
  fd.set('studies_exception', 'true');
  fd.set('data_destruction_due', 'on_termination');
  for (const [k, v] of Object.entries(overrides)) {
    if (v === '__DELETE__') {
      fd.delete(k);
    } else {
      fd.set(k, v);
    }
  }
  return fd;
}

describe('parsePartnerAgreementForm', () => {
  it('returns ok:true for a valid form', () => {
    const r = parsePartnerAgreementForm(makeFormData());
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.input.partnerOrgId).toBe('school-uuid-001');
    expect(r.input.effectiveDate).toBe('2026-08-01');
    expect(r.input.endDate).toBeNull();
    expect(r.input.terms.kind).toBe('ferpa');
    expect(r.input.terms.scope).toContain('attendance_patterns');
    expect(r.input.terms.studies_exception_invoked).toBe(true);
    expect(r.input.terms.data_destruction_due).toBe('on_termination');
  });

  it('rejects missing partnerOrgId', () => {
    const r = parsePartnerAgreementForm(makeFormData({ partnerOrgId: '' }));
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.error).toMatch(/district/i);
  });

  it('rejects missing effectiveDate', () => {
    const r = parsePartnerAgreementForm(makeFormData({ effectiveDate: '' }));
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.error).toMatch(/effective date/i);
  });

  it('rejects an invalid effectiveDate', () => {
    const r = parsePartnerAgreementForm(makeFormData({ effectiveDate: 'not-a-date' }));
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.error).toMatch(/not a valid date/i);
  });

  it('rejects endDate before effectiveDate', () => {
    const r = parsePartnerAgreementForm(
      makeFormData({ effectiveDate: '2026-08-01', endDate: '2026-07-01' }),
    );
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.error).toMatch(/end date must be on or after/i);
  });

  it('accepts an open-ended agreement (no endDate)', () => {
    const r = parsePartnerAgreementForm(makeFormData({ endDate: '' }));
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.input.endDate).toBeNull();
  });

  it('accepts a valid endDate after effectiveDate', () => {
    const r = parsePartnerAgreementForm(
      makeFormData({ effectiveDate: '2026-08-01', endDate: '2027-07-31' }),
    );
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.input.endDate).toBe('2027-07-31');
  });

  it('rejects missing district_name', () => {
    const r = parsePartnerAgreementForm(makeFormData({ district_name: '' }));
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.error).toMatch(/district name/i);
  });

  it('rejects missing liaison_name', () => {
    const r = parsePartnerAgreementForm(makeFormData({ liaison_name: '' }));
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.error).toMatch(/liaison name/i);
  });

  it('rejects missing liaison_email', () => {
    const r = parsePartnerAgreementForm(makeFormData({ liaison_email: '' }));
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.error).toMatch(/liaison email/i);
  });

  it('rejects a liaison_email without @', () => {
    const r = parsePartnerAgreementForm(makeFormData({ liaison_email: 'notanemail' }));
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.error).toMatch(/valid email/i);
  });

  it('rejects empty scope (no checkboxes checked)', () => {
    const fd = makeFormData();
    fd.delete('scope_attendance_patterns');
    const r = parsePartnerAgreementForm(fd);
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.error).toMatch(/scope/i);
  });

  it('accepts multiple scope checkboxes', () => {
    const fd = makeFormData({
      scope_attendance_patterns: 'on',
      scope_mckinney_vento_ids: 'on',
      scope_address_changes: 'on',
    });
    const r = parsePartnerAgreementForm(fd);
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.input.terms.scope).toContain('attendance_patterns');
    expect(r.input.terms.scope).toContain('mckinney_vento_ids');
    expect(r.input.terms.scope).toContain('address_changes');
  });

  it('rejects missing studies_exception selection', () => {
    const r = parsePartnerAgreementForm(makeFormData({ studies_exception: '' }));
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.error).toMatch(/studies exception/i);
  });

  it('parses studies_exception=false correctly', () => {
    const r = parsePartnerAgreementForm(makeFormData({ studies_exception: 'false' }));
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.input.terms.studies_exception_invoked).toBe(false);
  });

  it('rejects invalid data_destruction_due', () => {
    const r = parsePartnerAgreementForm(makeFormData({ data_destruction_due: 'immediately' }));
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.error).toMatch(/data destruction/i);
  });

  it('accepts all valid data_destruction_due values', () => {
    for (const val of ['on_termination', 'after_5_years', 'never_required']) {
      const r = parsePartnerAgreementForm(makeFormData({ data_destruction_due: val }));
      expect(r.ok).toBe(true);
      if (!r.ok) continue;
      expect(r.input.terms.data_destruction_due).toBe(val);
    }
  });

  it('treats empty notes as null', () => {
    const r = parsePartnerAgreementForm(makeFormData({ notes: '   ' }));
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.input.notes).toBeNull();
  });

  it('rejects notes longer than 2000 chars', () => {
    const r = parsePartnerAgreementForm(makeFormData({ notes: 'a'.repeat(2001) }));
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.error).toMatch(/2 000/);
  });

  it('passes signedByPartner through', () => {
    const r = parsePartnerAgreementForm(
      makeFormData({ signedByPartner: 'Dr. Bob Jones, Superintendent' }),
    );
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.input.signedByPartner).toBe('Dr. Bob Jones, Superintendent');
  });

  it('treats empty signedByPartner as null', () => {
    const r = parsePartnerAgreementForm(makeFormData({ signedByPartner: '' }));
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.input.signedByPartner).toBeNull();
  });

  it('includes optional liaison_phone when provided', () => {
    const r = parsePartnerAgreementForm(makeFormData({ liaison_phone: '(270) 555-0100' }));
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.input.terms.liaison_contact.phone).toBe('(270) 555-0100');
  });

  it('omits liaison_phone when blank', () => {
    const r = parsePartnerAgreementForm(makeFormData({ liaison_phone: '' }));
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.input.terms.liaison_contact.phone).toBeUndefined();
  });
});

// ---------------------------------------------------------------------------
// parseDcbsDsaAgreementForm (DTRS-011)
// ---------------------------------------------------------------------------

function makeDcbsFormData(overrides: Record<string, string> = {}): FormData {
  const fd = new FormData();
  fd.set('partnerOrgId', 'dcbs-uuid-001');
  fd.set('effectiveDate', '2026-09-01');
  fd.set(
    'agency_legal_name',
    'Kentucky Cabinet for Health and Family Services, Department for Community Based Services',
  );
  fd.set('state_contact_name', 'Robin Davis');
  fd.set('state_contact_title', 'Service Region Administrator');
  fd.set('state_contact_email', 'robin.davis@ky.gov');
  fd.set('scope_foster_aging_out_roster', 'on');
  fd.set('individual_records_authorized', 'true');
  fd.set('data_destruction_due', 'on_termination');
  for (const [k, v] of Object.entries(overrides)) {
    if (v === '__DELETE__') {
      fd.delete(k);
    } else {
      fd.set(k, v);
    }
  }
  return fd;
}

describe('parseDcbsDsaAgreementForm', () => {
  it('returns ok:true for a valid form', () => {
    const r = parseDcbsDsaAgreementForm(makeDcbsFormData());
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.input.partnerOrgId).toBe('dcbs-uuid-001');
    expect(r.input.effectiveDate).toBe('2026-09-01');
    expect(r.input.endDate).toBeNull();
    expect(r.input.terms.kind).toBe('dsa');
    expect(r.input.terms.agency).toBe('dcbs');
    expect(r.input.terms.scope).toContain('foster_aging_out_roster');
    expect(r.input.terms.individual_records_authorized).toBe(true);
    expect(r.input.terms.population_focus).toBe('foster_aging_out');
    expect(r.input.terms.data_destruction_due).toBe('on_termination');
  });

  it('rejects missing partnerOrgId', () => {
    const r = parseDcbsDsaAgreementForm(makeDcbsFormData({ partnerOrgId: '' }));
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.error).toMatch(/dcbs partner/i);
  });

  it('rejects missing agency_legal_name', () => {
    const r = parseDcbsDsaAgreementForm(makeDcbsFormData({ agency_legal_name: '' }));
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.error).toMatch(/agency legal name/i);
  });

  it('rejects missing state_contact_name', () => {
    const r = parseDcbsDsaAgreementForm(makeDcbsFormData({ state_contact_name: '' }));
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.error).toMatch(/contact name/i);
  });

  it('rejects missing state_contact_title', () => {
    const r = parseDcbsDsaAgreementForm(makeDcbsFormData({ state_contact_title: '' }));
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.error).toMatch(/contact title/i);
  });

  it('rejects state_contact_email without @', () => {
    const r = parseDcbsDsaAgreementForm(makeDcbsFormData({ state_contact_email: 'not-an-email' }));
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.error).toMatch(/valid email/i);
  });

  it('rejects no scope checkboxes selected', () => {
    const r = parseDcbsDsaAgreementForm(makeDcbsFormData({ scope_foster_aging_out_roster: '' }));
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.error).toMatch(/at least one data scope/i);
  });

  it('collects multiple scope checkboxes', () => {
    const r = parseDcbsDsaAgreementForm(
      makeDcbsFormData({
        scope_placement_history: 'on',
        scope_supports_in_place: 'on',
        scope_teamky_eligibility: 'on',
      }),
    );
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.input.terms.scope.sort()).toEqual([
      'foster_aging_out_roster',
      'placement_history',
      'supports_in_place',
      'teamky_eligibility',
    ]);
  });

  it('rejects unknown individual_records_authorized value', () => {
    const r = parseDcbsDsaAgreementForm(
      makeDcbsFormData({ individual_records_authorized: 'maybe' }),
    );
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.error).toMatch(/individual-records authorization/i);
  });

  it('parses individual_records_authorized=false correctly', () => {
    const r = parseDcbsDsaAgreementForm(
      makeDcbsFormData({ individual_records_authorized: 'false' }),
    );
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.input.terms.individual_records_authorized).toBe(false);
  });

  it('rejects unknown data_destruction_due value', () => {
    const r = parseDcbsDsaAgreementForm(
      makeDcbsFormData({ data_destruction_due: 'never_required' }),
    );
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.error).toMatch(/data destruction policy/i);
  });

  it('accepts after_3_years and after_5_years destruction values', () => {
    for (const val of ['after_3_years', 'after_5_years']) {
      const r = parseDcbsDsaAgreementForm(makeDcbsFormData({ data_destruction_due: val }));
      expect(r.ok).toBe(true);
      if (!r.ok) return;
      expect(r.input.terms.data_destruction_due).toBe(val);
    }
  });

  it('rejects endDate before effectiveDate', () => {
    const r = parseDcbsDsaAgreementForm(
      makeDcbsFormData({ effectiveDate: '2026-09-01', endDate: '2026-08-01' }),
    );
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.error).toMatch(/end date must be on or after/i);
  });

  it('accepts open-ended agreement (no endDate)', () => {
    const r = parseDcbsDsaAgreementForm(makeDcbsFormData({ endDate: '' }));
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.input.endDate).toBeNull();
  });

  it('includes optional state_contact_phone when provided', () => {
    const r = parseDcbsDsaAgreementForm(
      makeDcbsFormData({ state_contact_phone: '(502) 555-0100' }),
    );
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.input.terms.state_contact.phone).toBe('(502) 555-0100');
  });

  it('rejects notes longer than 2000 chars', () => {
    const r = parseDcbsDsaAgreementForm(makeDcbsFormData({ notes: 'x'.repeat(2001) }));
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.error).toMatch(/2 000 characters/i);
  });
});
