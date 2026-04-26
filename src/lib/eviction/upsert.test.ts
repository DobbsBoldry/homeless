import { describe, expect, it } from 'vitest';
import type { EvictionFiling, NewEvictionFiling } from '@/db/schema/eviction-filings';
import { decideUpsert, fieldsChanged } from './upsert-rules';

const baseExisting: EvictionFiling = {
  id: '00000000-0000-0000-0000-000000000001',
  caseNumber: 'SYN-26-CI-00001',
  filedAt: new Date('2026-04-01T10:00:00-05:00'),
  courtDivision: '1st Division',
  plaintiff: 'Mock LLC',
  defendantFirstName: 'Marcus',
  defendantLastName: 'Synthwell',
  defendantAddress: '123 Synth St',
  causeType: 'non_payment',
  amountClaimedCents: 100_000,
  status: 'filed',
  source: 'synthetic',
  rawJson: null,
  dvFlag: false,
  createdAt: new Date(),
  updatedAt: new Date(),
};

const baseIncoming: NewEvictionFiling = {
  caseNumber: 'SYN-26-CI-00001',
  filedAt: baseExisting.filedAt,
  courtDivision: '1st Division',
  plaintiff: 'Mock LLC',
  defendantFirstName: 'Marcus',
  defendantLastName: 'Synthwell',
  defendantAddress: '123 Synth St',
  causeType: 'non_payment',
  amountClaimedCents: 100_000,
  status: 'filed',
  source: 'synthetic',
  rawJson: undefined,
};

describe('decideUpsert', () => {
  it('inserts when no row exists for the case_number', () => {
    expect(decideUpsert([], baseIncoming).action).toBe('inserted');
  });

  it('returns unchanged when same source row exists with identical fields', () => {
    const d = decideUpsert([baseExisting], baseIncoming);
    expect(d.action).toBe('unchanged');
    expect(d.existingMatch).toBe(baseExisting);
  });

  it('returns updated when status changes', () => {
    const d = decideUpsert([baseExisting], { ...baseIncoming, status: 'served' });
    expect(d.action).toBe('updated');
    expect(d.existingMatch?.status).toBe('filed');
  });

  it('returns updated when amount_claimed_cents changes', () => {
    const d = decideUpsert([baseExisting], { ...baseIncoming, amountClaimedCents: 250_000 });
    expect(d.action).toBe('updated');
  });

  it('returns updated when defendant_address changes', () => {
    const d = decideUpsert([baseExisting], { ...baseIncoming, defendantAddress: '456 Fake Ave' });
    expect(d.action).toBe('updated');
  });

  it('returns updated when address goes from a value to null', () => {
    const d = decideUpsert([baseExisting], { ...baseIncoming, defendantAddress: null });
    expect(d.action).toBe('updated');
  });

  it('treats null === null as unchanged', () => {
    const noAddr: EvictionFiling = { ...baseExisting, defendantAddress: null };
    const d = decideUpsert([noAddr], { ...baseIncoming, defendantAddress: null });
    expect(d.action).toBe('unchanged');
  });

  it('treats undefined incoming address as null for comparison', () => {
    const noAddr: EvictionFiling = { ...baseExisting, defendantAddress: null };
    const { defendantAddress: _, ...noAddrIn } = baseIncoming;
    const d = decideUpsert([noAddr], noAddrIn as NewEvictionFiling);
    expect(d.action).toBe('unchanged');
  });

  it('inserts when same case_number exists but for a different source', () => {
    // synthetic row exists; manual row coming in (different source, same rank-or-higher)
    const d = decideUpsert([baseExisting], { ...baseIncoming, source: 'manual' });
    expect(d.action).toBe('inserted');
  });
});

describe('decideUpsert — source-rank precedence', () => {
  const courtnetRow: EvictionFiling = { ...baseExisting, source: 'courtnet' };

  it('lower-rank synthetic is superseded by existing courtnet row', () => {
    const d = decideUpsert([courtnetRow], baseIncoming); // baseIncoming.source = synthetic
    expect(d.action).toBe('superseded');
    expect(d.existingMatch).toBe(courtnetRow);
  });

  it('manual is superseded by existing courtnet', () => {
    const d = decideUpsert([courtnetRow], { ...baseIncoming, source: 'manual' });
    expect(d.action).toBe('superseded');
  });

  it('courtnet is NOT superseded — inserts as new row even when synthetic exists', () => {
    const d = decideUpsert([baseExisting], { ...baseIncoming, source: 'courtnet' });
    expect(d.action).toBe('inserted');
  });

  it('courtnet UPDATES its existing courtnet row (not superseded by self)', () => {
    const d = decideUpsert([courtnetRow], {
      ...baseIncoming,
      source: 'courtnet',
      status: 'judgment',
    });
    expect(d.action).toBe('updated');
  });

  it('multiple existing sources: incoming hits the same-source row', () => {
    const synRow: EvictionFiling = { ...baseExisting, source: 'synthetic' };
    const manRow: EvictionFiling = { ...baseExisting, source: 'manual' };
    // Manual incoming, no courtnet exists → updates the manual row
    const d = decideUpsert([synRow, manRow], {
      ...baseIncoming,
      source: 'manual',
      status: 'served',
    });
    expect(d.action).toBe('updated');
    expect(d.existingMatch?.source).toBe('manual');
  });
});

describe('fieldsChanged', () => {
  it('identical -> false', () => {
    expect(fieldsChanged(baseExisting, baseIncoming)).toBe(false);
  });
  it.each([
    ['status', { status: 'served' }],
    ['amount', { amountClaimedCents: 999 }],
    ['address', { defendantAddress: 'somewhere else' }],
    ['plaintiff', { plaintiff: 'Different Plaintiff LLC' }],
    ['cause', { causeType: 'holdover' }],
  ] as const)('detects %s change', (_label, patch) => {
    expect(fieldsChanged(baseExisting, { ...baseIncoming, ...patch })).toBe(true);
  });
});
