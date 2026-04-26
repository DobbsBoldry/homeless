import { sql } from 'drizzle-orm';
import { db } from '@/db/client';
import { auditLog } from '@/db/schema/audit-log';
import { evictionCaseOutcomes } from '@/db/schema/eviction-case-outcomes';
import { evictionFilings } from '@/db/schema/eviction-filings';
import { evictionResponsePackets } from '@/db/schema/eviction-response-packets';
import { partnerOrgs } from '@/db/schema/partner-orgs';
import { partnerServiceEvents } from '@/db/schema/partner-service-events';
import { shelters } from '@/db/schema/shelters';

/**
 * OPRT-006 public outcome dashboard data layer. Every query returns
 * coalition-level AGGREGATE counts only — never per-person, never
 * per-shelter address, never anything that could identify a subject
 * or a survivor. The threshold rule we follow: any cell smaller
 * than 5 is suppressed (returned as null), so no count traces back
 * to a small handful of identifiable people.
 *
 * Quarter labelling follows calendar quarters in UTC.
 */

export type Quarter = { year: number; quarter: 1 | 2 | 3 | 4; label: string };

export function quarterFromDate(d: Date): Quarter {
  const year = d.getUTCFullYear();
  const month = d.getUTCMonth(); // 0-11
  const quarter = (Math.floor(month / 3) + 1) as 1 | 2 | 3 | 4;
  return { year, quarter, label: `${year} Q${quarter}` };
}

export function listLastNQuarters(now: Date, n: number): Quarter[] {
  const cur = quarterFromDate(now);
  const out: Quarter[] = [];
  let year = cur.year;
  let quarter: number = cur.quarter;
  for (let i = 0; i < n; i++) {
    out.push({ year, quarter: quarter as 1 | 2 | 3 | 4, label: `${year} Q${quarter}` });
    quarter -= 1;
    if (quarter === 0) {
      quarter = 4;
      year -= 1;
    }
  }
  return out.reverse();
}

const SUPPRESSION_THRESHOLD = 5;

/** Returns the count if ≥ threshold, else null. */
function suppress(value: number): number | null {
  return value >= SUPPRESSION_THRESHOLD ? value : null;
}

export type QuarterlyEvictionAggregate = {
  quarter: Quarter;
  /** Filings ingested. null if below the suppression threshold. */
  filingsIngested: number | null;
  /** Filings (in this quarter) that received a response packet. */
  filingsWithPacket: number | null;
  /** Outcomes recorded in this quarter (filed, dismissed, etc.). */
  outcomesRecorded: number | null;
  /** Default-judgment outcomes in this quarter — the avoid-this metric. */
  defaultJudgments: number | null;
};

export async function listQuarterlyEvictionAggregates(
  quarters: Quarter[],
): Promise<QuarterlyEvictionAggregate[]> {
  const out: QuarterlyEvictionAggregate[] = [];
  for (const q of quarters) {
    const start = new Date(Date.UTC(q.year, (q.quarter - 1) * 3, 1));
    const end = new Date(Date.UTC(q.year, q.quarter * 3, 1));

    const [filingsRow] = await db.execute<{ count: number }>(sql`
      SELECT COUNT(*)::int AS count FROM ${evictionFilings}
      WHERE filed_at >= ${start} AND filed_at < ${end}
    `);
    const [packetsRow] = await db.execute<{ count: number }>(sql`
      SELECT COUNT(DISTINCT ${evictionResponsePackets.filingId})::int AS count
      FROM ${evictionResponsePackets}
      INNER JOIN ${evictionFilings} ON ${evictionFilings.id} = ${evictionResponsePackets.filingId}
      WHERE ${evictionFilings.filedAt} >= ${start} AND ${evictionFilings.filedAt} < ${end}
    `);
    const [outcomesRow] = await db.execute<{ count: number }>(sql`
      SELECT COUNT(*)::int AS count FROM ${evictionCaseOutcomes}
      WHERE created_at >= ${start} AND created_at < ${end}
    `);
    const [defaultRow] = await db.execute<{ count: number }>(sql`
      SELECT COUNT(*)::int AS count FROM ${evictionCaseOutcomes}
      WHERE outcome = 'default_judgment' AND created_at >= ${start} AND created_at < ${end}
    `);

    out.push({
      quarter: q,
      filingsIngested: suppress(Number(filingsRow.count)),
      filingsWithPacket: suppress(Number(packetsRow.count)),
      outcomesRecorded: suppress(Number(outcomesRow.count)),
      defaultJudgments: suppress(Number(defaultRow.count)),
    });
  }
  return out;
}

export type CoalitionAggregate = {
  /** Total active partner orgs in the directory (no suppression — names are public). */
  partnerCount: number;
  /** Number of partners with data_sharing_tier != 'none'. */
  partnersSharing: number;
  /** Active shelters listed. Public; not suppressed. */
  shelterCount: number;
  /** Sum of capacity across shelters. */
  totalShelterCapacity: number;
  /** Cross-org touchpoints (events) in the last `windowDays` days. Suppressed if low. */
  serviceEventsRolling: number | null;
  /** Distinct opaque persons touched in the same window. Suppressed if low. */
  uniquePeopleRolling: number | null;
  rollingWindowDays: number;
};

export async function getCoalitionAggregate(rollingWindowDays = 90): Promise<CoalitionAggregate> {
  const since = new Date();
  since.setUTCDate(since.getUTCDate() - rollingWindowDays);

  const [partners] = await db.execute<{ count: number; sharing: number }>(sql`
    SELECT
      COUNT(*) FILTER (WHERE active = true)::int AS count,
      COUNT(*) FILTER (WHERE active = true AND data_sharing_tier <> 'none')::int AS sharing
    FROM ${partnerOrgs}
  `);
  const [shelterRow] = await db.execute<{ count: number; capacity: number }>(sql`
    SELECT
      COUNT(*) FILTER (WHERE active = true)::int AS count,
      COALESCE(SUM(capacity) FILTER (WHERE active = true), 0)::int AS capacity
    FROM ${shelters}
  `);
  const [eventsRow] = await db.execute<{ events: number; people: number }>(sql`
    SELECT
      COUNT(*)::int AS events,
      COUNT(DISTINCT synthetic_person_ref)::int AS people
    FROM ${partnerServiceEvents}
    WHERE event_at >= ${since}
  `);

  return {
    partnerCount: Number(partners.count),
    partnersSharing: Number(partners.sharing),
    shelterCount: Number(shelterRow.count),
    totalShelterCapacity: Number(shelterRow.capacity),
    serviceEventsRolling: suppress(Number(eventsRow.events)),
    uniquePeopleRolling: suppress(Number(eventsRow.people)),
    rollingWindowDays,
  };
}

export type GovernanceCounts = {
  /** Consent grants in the last 90 days. Suppressed if low. */
  consentGrants90d: number | null;
  /** Consent revocations in the last 90 days. Suppressed if low. */
  consentRevocations90d: number | null;
  /** Per-record data-access events logged in the last 90 days. */
  dataAccessEvents90d: number | null;
};

export async function getGovernanceCounts(): Promise<GovernanceCounts> {
  const since = new Date();
  since.setUTCDate(since.getUTCDate() - 90);

  const [row] = await db.execute<{ grants: number; revocations: number; access: number }>(sql`
    SELECT
      COUNT(*) FILTER (WHERE action = 'consent.granted')::int AS grants,
      COUNT(*) FILTER (WHERE action = 'consent.revoked')::int AS revocations,
      COUNT(*) FILTER (WHERE action = 'data.accessed')::int AS access
    FROM ${auditLog}
    WHERE created_at >= ${since}
  `);
  return {
    consentGrants90d: suppress(Number(row.grants)),
    consentRevocations90d: suppress(Number(row.revocations)),
    dataAccessEvents90d: suppress(Number(row.access)),
  };
}

export type GovernanceCountsForQuarter = {
  consentGrants: number | null;
  consentRevocations: number | null;
  dataAccessEvents: number | null;
};

/** Quarter-scoped variant of governance counts for the transparency report. */
export async function getGovernanceCountsForQuarter(
  q: Quarter,
): Promise<GovernanceCountsForQuarter> {
  const start = new Date(Date.UTC(q.year, (q.quarter - 1) * 3, 1));
  const end = new Date(Date.UTC(q.year, q.quarter * 3, 1));
  const [row] = await db.execute<{ grants: number; revocations: number; access: number }>(sql`
    SELECT
      COUNT(*) FILTER (WHERE action = 'consent.granted')::int AS grants,
      COUNT(*) FILTER (WHERE action = 'consent.revoked')::int AS revocations,
      COUNT(*) FILTER (WHERE action = 'data.accessed')::int AS access
    FROM ${auditLog}
    WHERE created_at >= ${start} AND created_at < ${end}
  `);
  return {
    consentGrants: suppress(Number(row.grants)),
    consentRevocations: suppress(Number(row.revocations)),
    dataAccessEvents: suppress(Number(row.access)),
  };
}
