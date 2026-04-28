/**
 * Unit tests for `parseDraftApplicationForm` — the pure FormData parser
 * for the SUBP-002 application draft form.
 */

import { describe, expect, it } from 'vitest';
import { parseDraftApplicationForm } from './medicaid-extension-parse';

function makeFormData(overrides: Record<string, string> = {}): FormData {
  const fd = new FormData();
  fd.set('in_foster_care_at_18', 'true');
  fd.set('student_status', 'high_school');
  fd.set('employment_status', 'part_time');
  fd.set('current_address_synthetic', '123 Synthetic Lane, Owensboro, KY');
  for (const [k, v] of Object.entries(overrides)) {
    if (v === '__DELETE__') fd.delete(k);
    else fd.set(k, v);
  }
  return fd;
}

describe('parseDraftApplicationForm', () => {
  it('returns ok:true for valid input', () => {
    const r = parseDraftApplicationForm(makeFormData());
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.payload.in_foster_care_at_18).toBe(true);
    expect(r.payload.student_status).toBe('high_school');
    expect(r.payload.employment_status).toBe('part_time');
  });

  it('parses in_foster_care_at_18=false correctly', () => {
    const r = parseDraftApplicationForm(makeFormData({ in_foster_care_at_18: 'false' }));
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.payload.in_foster_care_at_18).toBe(false);
  });

  it('rejects missing in_foster_care_at_18', () => {
    const r = parseDraftApplicationForm(makeFormData({ in_foster_care_at_18: '' }));
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.error).toMatch(/foster-care-at-18/i);
  });

  it('rejects invalid in_foster_care_at_18 value', () => {
    const r = parseDraftApplicationForm(makeFormData({ in_foster_care_at_18: 'maybe' }));
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.error).toMatch(/foster-care-at-18/i);
  });

  it('rejects missing current_address_synthetic', () => {
    const r = parseDraftApplicationForm(makeFormData({ current_address_synthetic: '' }));
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.error).toMatch(/current address/i);
  });

  it('rejects invalid student_status', () => {
    const r = parseDraftApplicationForm(makeFormData({ student_status: 'phd' }));
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.error).toMatch(/student_status/i);
  });

  it('rejects notes longer than 2 000 chars', () => {
    const r = parseDraftApplicationForm(makeFormData({ caseworker_notes: 'x'.repeat(2001) }));
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.error).toMatch(/2 000/);
  });

  it('treats blank caseworker_notes as undefined', () => {
    const r = parseDraftApplicationForm(makeFormData({ caseworker_notes: '' }));
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.payload.caseworker_notes).toBeUndefined();
  });
});
