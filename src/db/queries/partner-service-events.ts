import { count, desc, eq, gte, sql } from 'drizzle-orm';
import { db } from '@/db/client';
import { partnerOrgs } from '@/db/schema/partner-orgs';
import { partnerServiceEvents } from '@/db/schema/partner-service-events';

export interface PersonAggregate {
  syntheticPersonRef: string;
  totalEvents: number;
  uniqueOrgs: number;
  latestEventAt: Date;
  /** Names of partner orgs touched, latest event first per org. */
  orgNames: string[];
}

/**
 * Per-person aggregate of cross-org touchpoints in the lookback window.
 * Ordered by uniqueOrgs DESC then totalEvents DESC then latestEventAt
 * DESC — the demo's headline 'this person asked 3 ministries this week'
 * lands at the top.
 */
export async function listCrossOrgTouchpoints(
  opts: { windowDays?: number; limit?: number } = {},
): Promise<PersonAggregate[]> {
  const { windowDays = 14, limit = 50 } = opts;
  const since = new Date();
  since.setDate(since.getDate() - windowDays);

  const rows = await db
    .select({
      syntheticPersonRef: partnerServiceEvents.syntheticPersonRef,
      totalEvents: count(partnerServiceEvents.id).as('total_events'),
      uniqueOrgs: sql<number>`COUNT(DISTINCT ${partnerServiceEvents.partnerOrgId})`.as(
        'unique_orgs',
      ),
      latestEventAt: sql<Date>`MAX(${partnerServiceEvents.eventAt})`.as('latest_event_at'),
      // Alphabetical order is deterministic — sorting by eventAt isn't
      // legal alongside DISTINCT name without a subquery, and stable
      // ordering matters more than the chronological story here.
      orgNames: sql<string[]>`array_agg(DISTINCT ${partnerOrgs.name} ORDER BY ${partnerOrgs.name})`.as(
        'org_names',
      ),
    })
    .from(partnerServiceEvents)
    .innerJoin(partnerOrgs, eq(partnerOrgs.id, partnerServiceEvents.partnerOrgId))
    .where(gte(partnerServiceEvents.eventAt, since))
    .groupBy(partnerServiceEvents.syntheticPersonRef)
    .orderBy(desc(sql`unique_orgs`), desc(sql`total_events`), desc(sql`latest_event_at`))
    .limit(limit);

  return rows.map((r) => ({
    syntheticPersonRef: r.syntheticPersonRef,
    totalEvents: Number(r.totalEvents),
    uniqueOrgs: Number(r.uniqueOrgs),
    latestEventAt:
      r.latestEventAt instanceof Date
        ? r.latestEventAt
        : new Date(r.latestEventAt as unknown as string),
    orgNames: r.orgNames ?? [],
  }));
}
