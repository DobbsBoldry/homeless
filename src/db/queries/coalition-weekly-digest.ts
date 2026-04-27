import { and, count, desc, eq, gte, inArray, isNotNull, isNull, sql } from 'drizzle-orm';
import { RISK_SCORE_MODEL_VERSION } from '@/ai/prompts/eviction-risk-score';
import { db } from '@/db/client';
import { clientIntakes } from '@/db/schema/client-intakes';
import { evictionFilingRiskScores } from '@/db/schema/eviction-filing-risk-scores';
import { evictionFilings } from '@/db/schema/eviction-filings';
import { evictionResponsePackets } from '@/db/schema/eviction-response-packets';
import { partnerOrgs } from '@/db/schema/partner-orgs';
import { partnerServiceEvents } from '@/db/schema/partner-service-events';
import { personPartnerConsents } from '@/db/schema/person-partner-consents';
import { listCrossOrgTouchpoints, type PersonAggregate } from './partner-service-events';

export type RecentHighRiskFiling = {
  id: string;
  caseNumber: string;
  plaintiff: string;
  score: number;
  packetStatus: string | null;
  filedAt: Date;
};

export type TopPartnerEventType = {
  partnerOrgName: string;
  eventType: string;
  count: number;
};

export type CoalitionWeeklyDigest = {
  since: Date;
  windowDays: number;
  // Aggregate counts
  newFilings: number;
  newIntakes: number;
  newServiceEvents: number;
  newConsentGrants: number;
  newConsentRevocations: number;
  urgentExtractedIntakes: number;
  highScoreFilingsNoPacket: number;
  // Top patterns (small samples for the AI to reason over)
  crossOrgTouchpoints: PersonAggregate[];
  recentHighRiskFilings: RecentHighRiskFiling[];
  topPartnerEventTypes: TopPartnerEventType[];
};

const HIGH_SCORE_THRESHOLD = 60;

export async function getCoalitionWeeklyDigest(
  opts: { windowDays?: number } = {},
): Promise<CoalitionWeeklyDigest> {
  const windowDays = opts.windowDays ?? 7;
  const since = new Date();
  since.setDate(since.getDate() - windowDays);

  const [
    [filingsAgg],
    [intakesAgg],
    [eventsAgg],
    [grantsAgg],
    [revocationsAgg],
    [urgentAgg],
    [hiNoPacketAgg],
    crossOrgTouchpoints,
    recentHighRiskRows,
    topEventTypeRows,
  ] = await Promise.all([
    db.select({ n: count() }).from(evictionFilings).where(gte(evictionFilings.filedAt, since)),
    db.select({ n: count() }).from(clientIntakes).where(gte(clientIntakes.createdAt, since)),
    db
      .select({ n: count() })
      .from(partnerServiceEvents)
      .where(gte(partnerServiceEvents.eventAt, since)),
    db
      .select({ n: count() })
      .from(personPartnerConsents)
      .where(gte(personPartnerConsents.grantedAt, since)),
    db
      .select({ n: count() })
      .from(personPartnerConsents)
      .where(
        and(
          isNotNull(personPartnerConsents.revokedAt),
          gte(personPartnerConsents.revokedAt, since),
        ),
      ),
    db
      .select({ n: count() })
      .from(clientIntakes)
      .where(
        and(
          eq(clientIntakes.status, 'extracted'),
          gte(clientIntakes.createdAt, since),
          sql`${clientIntakes.extractedProfile}->>'urgency' IN ('today', 'within_7_days')`,
        ),
      ),
    // High-score filings with no packet drafted yet (any time, not just window —
    // these are the action-blocked cases the coordinator should know about).
    db
      .select({ n: count() })
      .from(evictionFilings)
      .innerJoin(
        evictionFilingRiskScores,
        and(
          eq(evictionFilingRiskScores.filingId, evictionFilings.id),
          eq(evictionFilingRiskScores.modelVersion, RISK_SCORE_MODEL_VERSION),
        ),
      )
      .leftJoin(evictionResponsePackets, eq(evictionResponsePackets.filingId, evictionFilings.id))
      .where(
        and(
          gte(evictionFilingRiskScores.score, HIGH_SCORE_THRESHOLD),
          inArray(evictionFilings.status, ['filed', 'served']),
          isNull(evictionResponsePackets.id),
        ),
      ),
    listCrossOrgTouchpoints({ windowDays, limit: 5 }),
    db
      .select({
        filing: evictionFilings,
        score: evictionFilingRiskScores.score,
        packetStatus: evictionResponsePackets.status,
      })
      .from(evictionFilings)
      .innerJoin(
        evictionFilingRiskScores,
        and(
          eq(evictionFilingRiskScores.filingId, evictionFilings.id),
          eq(evictionFilingRiskScores.modelVersion, RISK_SCORE_MODEL_VERSION),
        ),
      )
      .leftJoin(evictionResponsePackets, eq(evictionResponsePackets.filingId, evictionFilings.id))
      .where(
        and(
          gte(evictionFilings.filedAt, since),
          gte(evictionFilingRiskScores.score, HIGH_SCORE_THRESHOLD),
        ),
      )
      .orderBy(desc(evictionFilingRiskScores.score), desc(evictionFilings.filedAt))
      .limit(5),
    db
      .select({
        partnerOrgName: partnerOrgs.name,
        eventType: partnerServiceEvents.eventType,
        n: count(),
      })
      .from(partnerServiceEvents)
      .innerJoin(partnerOrgs, eq(partnerOrgs.id, partnerServiceEvents.partnerOrgId))
      .where(gte(partnerServiceEvents.eventAt, since))
      .groupBy(partnerOrgs.name, partnerServiceEvents.eventType)
      .orderBy(desc(count()))
      .limit(10),
  ]);

  const recentHighRiskFilings: RecentHighRiskFiling[] = recentHighRiskRows.map((r) => ({
    id: r.filing.id,
    caseNumber: r.filing.caseNumber,
    plaintiff: r.filing.plaintiff,
    score: r.score,
    packetStatus: r.packetStatus,
    filedAt: r.filing.filedAt,
  }));

  const topPartnerEventTypes: TopPartnerEventType[] = topEventTypeRows.map((r) => ({
    partnerOrgName: r.partnerOrgName,
    eventType: r.eventType,
    count: Number(r.n),
  }));

  return {
    since,
    windowDays,
    newFilings: Number(filingsAgg?.n ?? 0),
    newIntakes: Number(intakesAgg?.n ?? 0),
    newServiceEvents: Number(eventsAgg?.n ?? 0),
    newConsentGrants: Number(grantsAgg?.n ?? 0),
    newConsentRevocations: Number(revocationsAgg?.n ?? 0),
    urgentExtractedIntakes: Number(urgentAgg?.n ?? 0),
    highScoreFilingsNoPacket: Number(hiNoPacketAgg?.n ?? 0),
    crossOrgTouchpoints,
    recentHighRiskFilings,
    topPartnerEventTypes,
  };
}
