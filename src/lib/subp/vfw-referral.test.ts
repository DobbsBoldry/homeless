import { describe, expect, it } from 'vitest';
import {
  buildVfwReferralPacket,
  deriveVeteranVoucherStage,
  VFW_OWENSBORO_RECIPIENT,
} from './vfw-referral';

describe('deriveVeteranVoucherStage', () => {
  it('returns not_applied when there are no applications', () => {
    expect(deriveVeteranVoucherStage([])).toBe('not_applied');
  });

  it('ignores withdrawn applications', () => {
    expect(deriveVeteranVoucherStage([{ status: 'withdrawn' }])).toBe('not_applied');
  });

  it('returns the furthest stage across applications', () => {
    expect(deriveVeteranVoucherStage([{ status: 'applied' }, { status: 'pending' }])).toBe(
      'pending',
    );
    expect(
      deriveVeteranVoucherStage([
        { status: 'applied' },
        { status: 'housed' },
        { status: 'pending' },
      ]),
    ).toBe('housed');
    expect(deriveVeteranVoucherStage([{ status: 'approved' }, { status: 'applied' }])).toBe(
      'approved',
    );
  });
});

describe('buildVfwReferralPacket', () => {
  const veteran = {
    legalFirstName: 'Dana',
    legalLastName: 'Reyes',
    syntheticPersonRef: 'SP-0007',
    branchOfService: 'Army',
    eligibilitySource: 'va_confirmed' as const,
    caseworkerVerified: false,
    bedroomNeed: 2,
    accessibilityNeed: true,
    targetZip: '42301',
  };

  const matches = [
    {
      voucherCode: 'V-101',
      unitType: '2BR apartment',
      bedrooms: 2,
      location: 'Owensboro',
      zip: '42301',
      score: 100,
      applied: true,
      stage: 'applied' as const,
    },
    {
      voucherCode: 'V-202',
      unitType: '1BR apartment',
      bedrooms: 1,
      location: 'Whitesville',
      zip: '42378',
      score: 45,
      applied: false,
      stage: 'not_applied' as const,
    },
  ];

  it('addresses the packet to VFW Owensboro and stamps the subject', () => {
    const p = buildVfwReferralPacket({
      veteran,
      caseworkerName: 'C. Worker',
      matches,
      eligibilitySummary: 'VA documentation confirmed.',
    });
    expect(p.recipient).toBe(VFW_OWENSBORO_RECIPIENT);
    expect(p.subject.fullName).toBe('Dana Reyes');
    expect(p.subject.personRef).toBe('SP-0007');
    expect(p.subject.branchOfService).toBe('Army');
    expect(p.contact.caseworkerName).toBe('C. Worker');
    expect(p.eligibilitySummary).toBe('VA documentation confirmed.');
  });

  it('carries the matched vouchers sorted by score (highest first)', () => {
    const p = buildVfwReferralPacket({
      veteran,
      caseworkerName: null,
      matches: [matches[1], matches[0]],
      eligibilitySummary: 'x',
    });
    expect(p.matchedVouchers.map((m) => m.voucherCode)).toEqual(['V-101', 'V-202']);
    expect(p.matchedVouchers[0].score).toBe(100);
  });

  it('falls back to a placeholder when no caseworker is named', () => {
    const p = buildVfwReferralPacket({
      veteran,
      caseworkerName: null,
      matches,
      eligibilitySummary: 'x',
    });
    expect(p.contact.caseworkerName).toBe('Unassigned');
  });

  it('summarizes the housing profile', () => {
    const p = buildVfwReferralPacket({
      veteran,
      caseworkerName: null,
      matches,
      eligibilitySummary: 'x',
    });
    expect(p.subject.housingProfile).toContain('2 bedroom');
    expect(p.subject.housingProfile).toContain('accessible');
    expect(p.subject.housingProfile).toContain('42301');
  });
});
