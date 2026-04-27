import { describe, expect, it } from 'vitest';
import type {
  CoalitionAggregate,
  GovernanceCountsForQuarter,
  Quarter,
  QuarterlyEvictionAggregate,
} from '@/db/queries/public-outcomes';
import { renderFiscalCourtBrief } from './fiscal-court-brief';

type Input = {
  quarter: Quarter;
  evictionForQuarter: QuarterlyEvictionAggregate;
  coalitionSnapshot: CoalitionAggregate;
  governanceForQuarter: GovernanceCountsForQuarter;
  generatedAt: Date;
};

const baseInput = (): Input => ({
  quarter: { year: 2026, quarter: 2, label: '2026 Q2' },
  evictionForQuarter: {
    quarter: { year: 2026, quarter: 2, label: '2026 Q2' },
    filingsIngested: 142,
    filingsWithPacket: 87,
    outcomesRecorded: 56,
    defaultJudgments: 8,
  },
  coalitionSnapshot: {
    partnerCount: 25,
    partnersSharing: 7,
    shelterCount: 6,
    totalShelterCapacity: 220,
    serviceEventsRolling: 312,
    uniquePeopleRolling: 89,
    rollingWindowDays: 90,
  },
  governanceForQuarter: {
    consentGrants: 22,
    consentRevocations: 3,
    dataAccessEvents: 481,
  },
  generatedAt: new Date('2026-04-26T12:00:00Z'),
});

describe('renderFiscalCourtBrief', () => {
  it('leads with the headline number when packets are above suppression threshold', () => {
    const md = renderFiscalCourtBrief(baseInput());
    expect(md).toContain('# Daviess County Fiscal Court Brief — 2026 Q2');
    expect(md).toContain('87 Daviess households received an attorney-reviewed response');
  });

  it('uses the suppressed-headline copy when packets is null', () => {
    const input = baseInput();
    input.evictionForQuarter = { ...input.evictionForQuarter, filingsWithPacket: null };
    const md = renderFiscalCourtBrief(input);
    expect(md).toMatch(/A small number of households/);
    expect(md).toContain('count suppressed for privacy');
  });

  it('names the six anchor shelters', () => {
    const md = renderFiscalCourtBrief(baseInput());
    expect(md).toMatch(/Boulware/);
    expect(md).toMatch(/St\. Benedict's/);
    expect(md).toMatch(/Daniel Pitino/);
    expect(md).toMatch(/CrossRoads/);
    expect(md).toMatch(/OASIS/);
    expect(md).toMatch(/St\. Joseph/);
  });

  it('always includes "What\'s working" and "What\'s needed" sections', () => {
    const md = renderFiscalCourtBrief(baseInput());
    expect(md).toContain("## What's working");
    expect(md).toContain("## What's needed");
  });
});
