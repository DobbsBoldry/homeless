import type {
  CoalitionAggregate,
  GovernanceCountsForQuarter,
  Quarter,
  QuarterlyEvictionAggregate,
} from '@/db/queries/public-outcomes';

const fmt = (n: number | null): string => (n === null ? '— suppressed (n<5)' : String(n));

const fmtPct = (a: number | null, b: number | null): string => {
  if (a === null || b === null || b === 0) return '—';
  return `${Math.round((a / b) * 100)}%`;
};

/**
 * Render the quarterly transparency report as Markdown. Public-safe by
 * construction — every input is already aggregate (no row-level data;
 * <5 cells are suppressed at the query layer).
 *
 * The output is intentionally plain Markdown so it's printable, can be
 * pasted into a coalition newsletter, and renders cleanly in any GitHub
 * / Notion / Google Doc target.
 */
export function renderTransparencyReport(input: {
  quarter: Quarter;
  evictionForQuarter: QuarterlyEvictionAggregate;
  coalitionSnapshot: CoalitionAggregate;
  governanceForQuarter: GovernanceCountsForQuarter;
  generatedAt: Date;
}): string {
  const { quarter, evictionForQuarter, coalitionSnapshot, governanceForQuarter, generatedAt } =
    input;
  const repRate = fmtPct(evictionForQuarter.filingsWithPacket, evictionForQuarter.filingsIngested);
  return `# Daviess Coalition — ${quarter.label} Transparency Report

_Generated ${generatedAt.toISOString().slice(0, 10)} from live coalition data. Cells with fewer than 5 subjects are suppressed (rendered as "—") so no figure traces back to a small handful of identifiable people._

## Coalition snapshot

- **Partner organizations**: ${coalitionSnapshot.partnerCount} active
- **Partners actively sharing data**: ${coalitionSnapshot.partnersSharing}
- **Shelters listed**: ${coalitionSnapshot.shelterCount}
- **Total shelter capacity (coalition-wide)**: ${coalitionSnapshot.totalShelterCapacity} beds
- **Service events recorded (rolling ${coalitionSnapshot.rollingWindowDays}-day window)**: ${fmt(coalitionSnapshot.serviceEventsRolling)}
- **Distinct opaque persons touched (rolling window)**: ${fmt(coalitionSnapshot.uniquePeopleRolling)}

## Eviction defense — ${quarter.label}

| Metric | Value |
|---|---|
| Filings ingested | ${fmt(evictionForQuarter.filingsIngested)} |
| Filings with response packet | ${fmt(evictionForQuarter.filingsWithPacket)} |
| Representation rate | ${repRate} |
| Outcomes recorded | ${fmt(evictionForQuarter.outcomesRecorded)} |
| Default-judgment outcomes | ${fmt(evictionForQuarter.defaultJudgments)} |

Filings are public Daviess District Court records. Response packets are AI-drafted answers reviewed by a Kentucky Legal Aid attorney before filing. Default judgments are the avoid-this metric — they happen when a tenant doesn't respond at all and lose by default.

## Data trust governance — ${quarter.label}

| Metric | Value |
|---|---|
| Consent grants | ${fmt(governanceForQuarter.consentGrants)} |
| Consent revocations | ${fmt(governanceForQuarter.consentRevocations)} |
| Per-record accesses logged | ${fmt(governanceForQuarter.dataAccessEvents)} |

Every consent grant and revocation is timestamped. Every per-record access by a coalition staff member is logged in an append-only audit trail. Revocations are honored immediately; the data trust steward can audit any access at any time.

## How to read this report

- **Aggregate-only.** No personal data is exposed. The platform never identifies a specific person in this report; only counts.
- **Suppression.** Counts below 5 are hidden so a small group can't be re-identified by combining cells.
- **Append-only audit.** Consent and access counts come from a tamper-evident log enforced at the database layer.
- **Open-source.** The platform code, data model, and this report generator are all public. Anyone with technical chops can audit the math.

— End of report —
`;
}
