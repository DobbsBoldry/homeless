import { count, desc, eq, gte, sql } from 'drizzle-orm';
import { db } from '@/db/client';
import type { UserRole } from '@/db/schema/enums';
import { partnerOrgs } from '@/db/schema/partner-orgs';
import { partnerServiceEvents } from '@/db/schema/partner-service-events';
import { dvFlaggedSubset, viewerCanSeeDvAddresses } from '@/lib/dtrs/dv-blind';

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
      orgNames: sql<
        string[]
      >`array_agg(DISTINCT ${partnerOrgs.name} ORDER BY ${partnerOrgs.name})`.as('org_names'),
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

/**
 * Viewer-aware variant. DV-flagged refs are HIDDEN from viewers who
 * can't see addresses (DTRS-004 threat model: an abuser browsing the
 * coordination view to find their survivor's location). The listing
 * page renders attorneys and caseworkers see the survivor's row;
 * shelter staff and ED coordinators see the cross-org pattern with
 * the survivor's row absent — they still get the rest of the
 * coalition view.
 */
export async function listCrossOrgTouchpointsForViewer(
  opts: { windowDays?: number; limit?: number },
  viewerRole: UserRole,
): Promise<PersonAggregate[]> {
  const all = await listCrossOrgTouchpoints(opts);
  if (viewerCanSeeDvAddresses(viewerRole)) return all;

  const refs = all.map((r) => r.syntheticPersonRef);
  const flagged = await dvFlaggedSubset(refs);
  return all.filter((r) => !flagged.has(r.syntheticPersonRef));
}
