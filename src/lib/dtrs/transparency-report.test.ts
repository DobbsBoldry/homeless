import { describe, expect, it } from 'vitest';
import type {
  CoalitionAggregate,
  GovernanceCountsForQuarter,
  Quarter,
  QuarterlyEvictionAggregate,
} from '@/db/queries/public-outcomes';
import { renderTransparencyReport } from './transparency-report';

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

describe('renderTransparencyReport', () => {
  it('renders headline counts and the representation rate', () => {
    const md = renderTransparencyReport(baseInput());
    expect(md).toContain('# Daviess Coalition — 2026 Q2 Transparency Report');
    expect(md).toContain('Filings ingested | 142');
    expect(md).toContain('Filings with response packet | 87');
    // 87/142 ≈ 61%
    expect(md).toMatch(/Representation rate \| 61%/);
    expect(md).toContain('Default-judgment outcomes | 8');
  });

  it('shows suppressed cells as the placeholder copy', () => {
    const input = baseInput();
    input.evictionForQuarter = {
      ...input.evictionForQuarter,
      defaultJudgments: null,
      filingsWithPacket: null,
    };
    const md = renderTransparencyReport(input);
    expect(md).toMatch(/Default-judgment outcomes \| — suppressed/);
    // No representation rate when numerator is suppressed
    expect(md).toMatch(/Representation rate \| —/);
  });

  it('includes the generated date in YYYY-MM-DD form', () => {
    const md = renderTransparencyReport(baseInput());
    expect(md).toContain('Generated 2026-04-26');
  });

  it('always closes with the read-this-report explainer', () => {
    const md = renderTransparencyReport(baseInput());
    expect(md).toContain('How to read this report');
    expect(md).toContain('— End of report —');
  });
});
