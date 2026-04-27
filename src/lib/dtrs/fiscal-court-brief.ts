import type {
  CoalitionAggregate,
  GovernanceCountsForQuarter,
  Quarter,
  QuarterlyEvictionAggregate,
} from '@/db/queries/public-outcomes';

const fmt = (n: number | null): string => (n === null ? '—' : String(n));

/**
 * PCYI-001: 1-page Fiscal Court brief. Audience is the Daviess County
 * Fiscal Court (Judge-Executive + 3 commissioners) plus the Steering
 * Committee. Different framing than the public transparency report:
 * tighter, action-oriented, with a "what's working / what's needed"
 * structure that supports future appropriation requests.
 *
 * One page constraint — keep paragraphs short, lead with the headline
 * number for each pillar.
 *
 * Suppression rule (n<5 → null) is inherited from the upstream queries;
 * the renderer just translates null to em-dash.
 */
export function renderFiscalCourtBrief(input: {
  quarter: Quarter;
  evictionForQuarter: QuarterlyEvictionAggregate;
  coalitionSnapshot: CoalitionAggregate;
  governanceForQuarter: GovernanceCountsForQuarter;
  generatedAt: Date;
}): string {
  const { quarter, evictionForQuarter, coalitionSnapshot, governanceForQuarter, generatedAt } =
    input;

  const filings = evictionForQuarter.filingsIngested;
  const packets = evictionForQuarter.filingsWithPacket;
  const defaults = evictionForQuarter.defaultJudgments;

  // Headline: how many households did the coalition reach with legal
  // help this quarter? (Filings with response packets is the proxy.)
  const reachHeadline =
    packets === null
      ? 'A small number of households received drafted-and-reviewed legal responses this quarter (count suppressed for privacy).'
      : `${packets} Daviess households received an attorney-reviewed response to an eviction filing this quarter.`;

  return `# Daviess County Fiscal Court Brief — ${quarter.label}

**To:** Judge-Executive + Fiscal Court commissioners
**From:** Daviess County Homelessness-Response Coalition
**Generated:** ${generatedAt.toISOString().slice(0, 10)} from live coalition data

---

## ${quarter.label} headline

${reachHeadline} Coalition partners — ${coalitionSnapshot.partnerCount} organizations across legal aid, healthcare, shelters, and faith-based services — coordinated through a shared platform that records every consent grant and every record access in an append-only audit trail.

## Eviction defense

| Metric | This quarter |
|---|---|
| Court filings ingested | ${fmt(filings)} |
| Filings receiving response packet | ${fmt(packets)} |
| Default-judgment outcomes (the avoid-this metric) | ${fmt(defaults)} |

Filings come from the public Daviess District Court docket. Response packets are AI-drafted answers reviewed and approved by a Kentucky Legal Aid attorney before filing — the AI does the bulk drafting work; the attorney owns the legal product. Default judgments happen when a tenant doesn't respond at all, and result almost automatically in eviction. Reducing them is the platform's primary win condition.

## Shelter capacity

| Metric | Today |
|---|---|
| Active coalition shelters | ${coalitionSnapshot.shelterCount} |
| Coalition-wide bed capacity | ${coalitionSnapshot.totalShelterCapacity} |

Shelter staff update bed counts in real time; the SMS bed-finder lets unhoused individuals text for an open bed and place a 90-minute soft hold. Coordination across the six anchor shelters (Boulware, St. Benedict's, Daniel Pitino, CrossRoads, OASIS, St. Joseph) is consolidated rather than each provider operating in isolation.

## Coordination signal

Across the rolling ${coalitionSnapshot.rollingWindowDays}-day window:

- ${fmt(coalitionSnapshot.serviceEventsRolling)} service events recorded across coalition partners
- ${fmt(coalitionSnapshot.uniquePeopleRolling)} distinct opaque persons touched by 1+ partner

The coordination view shows when one person is asking multiple agencies for help in the same week — the kind of signal that would otherwise be invisible. Each entry is opaque (no names) until the subject explicitly grants cross-org consent.

## Data trust governance — ${quarter.label}

| Metric | This quarter |
|---|---|
| Consent grants recorded | ${fmt(governanceForQuarter.consentGrants)} |
| Consent revocations honored | ${fmt(governanceForQuarter.consentRevocations)} |
| Per-record accesses logged (audit) | ${fmt(governanceForQuarter.dataAccessEvents)} |

Every consent decision is timestamped. Every data access by coalition staff lands in an append-only audit log enforced at the database layer (not just in code). DV-survivor records have location-suppression applied at the query layer — an abuser browsing the system can't find a survivor's address through any coalition surface.

## What's working

- Cross-org coordination is happening through one platform rather than six.
- Eviction-defense response time is measured, not assumed.
- Privacy-respecting governance is a built-in feature, not a policy doc.

## What's needed

- Continued county recognition of the coalition's value as a coordination layer.
- Anchor partner participation across all six shelters (some still onboarding).
- Verification of benefits-program data (current DCBS / KHC / SSA thresholds) before next public push.
- BAA closure with Owensboro Health to unlock the ED super-utilizer pillar.

---

_This brief is regenerated on every page load against live data; for any quarter, visit the Coalition's outcomes page or contact the coordinator for the latest figures._
`;
}
