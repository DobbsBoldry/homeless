import { describe, expect, it } from 'vitest';
import { parseEvictionFiling } from './parser';

const validSynthetic = {
  case_number: 'SYN-26-CI-00417',
  filed_at: '2026-04-18T10:32:00-05:00',
  court_division: '1st Division',
  plaintiff: 'Mock Property Holdings LLC',
  defendant_first_name: 'Marcus',
  defendant_last_name: 'Synthwell',
  defendant_address: '123 Synth St, Apt 2C',
  cause_type: 'non_payment',
  amount_claimed_cents: 287_500,
  status: 'served',
  notes: 'Plaintiff alleges defendant failed to pay rent.',
  attorney_represented: false,
};

describe('parseEvictionFiling — happy path', () => {
  it('parses a valid synthetic record', () => {
    const result = parseEvictionFiling(validSynthetic);
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.filing.caseNumber).toBe('SYN-26-CI-00417');
    expect(result.filing.causeType).toBe('non_payment');
    expect(result.filing.status).toBe('served');
    expect(result.filing.amountClaimedCents).toBe(287_500);
    expect(result.filing.source).toBe('synthetic');
    expect(result.filing.filedAt).toBeInstanceOf(Date);
  });

  it.each([
    'non_payment',
    'lease_violation',
    'holdover',
    'other',
  ] as const)('accepts cause_type=%s', (causeType) => {
    const result = parseEvictionFiling({ ...validSynthetic, cause_type: causeType });
    expect(result.ok).toBe(true);
  });

  it.each([
    'filed',
    'served',
    'judgment',
    'dismissed',
    'sealed',
  ] as const)('accepts status=%s', (status) => {
    const result = parseEvictionFiling({ ...validSynthetic, status });
    expect(result.ok).toBe(true);
  });

  it('packs notes + attorney_represented + children_signal into rawJson', () => {
    const result = parseEvictionFiling(validSynthetic);
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    const raw = result.filing.rawJson as Record<string, unknown>;
    expect(raw.notes).toBe(validSynthetic.notes);
    expect(raw.attorney_represented).toBe(false);
    // EVDT-011: children_signal is always present (computed from notes
    // even when notes don't trip a detection — value = none).
    expect(raw.children_signal).toBeDefined();
  });

  it('still produces rawJson with children_signal even when notes / attorney_represented are absent', () => {
    const { notes: _n, attorney_represented: _a, ...minimal } = validSynthetic;
    const result = parseEvictionFiling(minimal);
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    const raw = result.filing.rawJson as Record<string, unknown>;
    expect(raw.notes).toBeUndefined();
    expect(raw.attorney_represented).toBeUndefined();
    expect(raw.children_signal).toEqual({
      detected: false,
      confidence: 'none',
      evidence: null,
    });
  });

  it('passes through manual source', () => {
    const result = parseEvictionFiling(validSynthetic, 'manual');
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.filing.source).toBe('manual');
  });
});

describe('parseEvictionFiling — errors', () => {
  it('reports ParseError for missing required fields', () => {
    const { case_number: _, ...missing } = validSynthetic;
    const result = parseEvictionFiling(missing);
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.errors.some((e) => e.field === 'case_number')).toBe(true);
  });

  it('reports ParseError for malformed date', () => {
    const result = parseEvictionFiling({ ...validSynthetic, filed_at: 'not-a-date' });
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.errors.some((e) => e.field === 'filed_at')).toBe(true);
  });

  it('reports ParseError for unknown cause_type', () => {
    const result = parseEvictionFiling({ ...validSynthetic, cause_type: 'extraterrestrial' });
    expect(result.ok).toBe(false);
  });

  it('reports ParseError for unknown status', () => {
    const result = parseEvictionFiling({ ...validSynthetic, status: 'pending' });
    expect(result.ok).toBe(false);
  });

  it('reports ParseError for non-object input', () => {
    expect(parseEvictionFiling(null).ok).toBe(false);
    expect(parseEvictionFiling('string-not-object').ok).toBe(false);
    expect(parseEvictionFiling(42).ok).toBe(false);
  });

  it('rejects unsupported source', () => {
    // 'courtnet' is a valid enum value but the parser doesn't handle that
    // source yet (lands in EVDT-005). Cast through unknown for the test.
    const result = parseEvictionFiling(
      validSynthetic,
      'courtnet' as Parameters<typeof parseEvictionFiling>[1],
    );
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.errors[0].field).toBe('source');
  });

  it('preserves the raw input on error for debugging', () => {
    const garbage = { not: 'a filing' };
    const result = parseEvictionFiling(garbage);
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.raw).toBe(garbage);
  });

  it('accepts amount_claimed_cents=null and defendant_address=null', () => {
    const result = parseEvictionFiling({
      ...validSynthetic,
      amount_claimed_cents: null,
      defendant_address: null,
    });
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.filing.amountClaimedCents).toBeNull();
    expect(result.filing.defendantAddress).toBeNull();
  });
});
