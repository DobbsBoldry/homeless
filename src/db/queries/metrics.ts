import { and, count, countDistinct, eq, gte, sql } from 'drizzle-orm';
import { db } from '@/db/client';
import { evictionCaseOutcomes } from '@/db/schema/eviction-case-outcomes';
import { evictionFilings } from '@/db/schema/eviction-filings';
import { evictionResponsePackets } from '@/db/schema/eviction-response-packets';

export interface MetricsKpis {
  /** Filings ingested in the last `windowDays` days. */
  filingsInWindow: number;
  /** Filings (in window) with at least one response packet generated. */
  filingsWithPacket: number;
  /** Packets currently in `approved` status (across all time). */
  packetsApproved: number;
  /** Packets currently in `filed` status (across all time). */
  packetsFiled: number;
  /** Total recorded outcome events (across all time). */
  outcomesRecorded: number;
}

export interface MetricsRates {
  /** Filings with a packet / total filings (in window). 0..1. */
  representationRate: number | null;
  /** Filings with outcome=default_judgment / filings with any outcome. */
  defaultJudgmentRate: number | null;
  /** Filings with outcome in {dismissed, judgment_for_defendant, settled} / filings with any outcome. */
  favorableOutcomeRate: number | null;
}

export interface DailyPoint {
  /** YYYY-MM-DD bucket (UTC date). */
  day: string;
  filings: number;
  packetsApproved: number;
}

const FAVORABLE_OUTCOMES = ['dismissed', 'judgment_for_defendant', 'settled'] as const;

const daysAgo = (days: number) => {
  const d = new Date();
  d.setUTCHours(0, 0, 0, 0);
  d.setUTCDate(d.getUTCDate() - days);
  return d;
};

export async function getMetricsKpis(windowDays = 30): Promise<MetricsKpis> {
  const since = daysAgo(windowDays);

  const [filingsRow] = await db
    .select({ value: count() })
    .from(evictionFilings)
    .where(gte(evictionFilings.filedAt, since));

  const [withPacketRow] = await db
    .select({ value: countDistinct(evictionResponsePackets.filingId) })
    .from(evictionResponsePackets)
    .innerJoin(evictionFilings, eq(evictionFilings.id, evictionResponsePackets.filingId))
    .where(gte(evictionFilings.filedAt, since));

  const [approvedRow] = await db
    .select({ value: count() })
    .from(evictionResponsePackets)
    .where(eq(evictionResponsePackets.status, 'approved'));

  const [filedRow] = await db
    .select({ value: count() })
    .from(evictionResponsePackets)
    .where(eq(evictionResponsePackets.status, 'filed'));

  const [outcomesRow] = await db.select({ value: count() }).from(evictionCaseOutcomes);

  return {
    filingsInWindow: filingsRow.value,
    filingsWithPacket: withPacketRow.value,
    packetsApproved: approvedRow.value,
    packetsFiled: filedRow.value,
    outcomesRecorded: outcomesRow.value,
  };
}

export async function getMetricsRates(windowDays = 30): Promise<MetricsRates> {
  const since = daysAgo(windowDays);

  const [filingsRow] = await db
    .select({ value: count() })
    .from(evictionFilings)
    .where(gte(evictionFilings.filedAt, since));

  const [withPacketRow] = await db
    .select({ value: countDistinct(evictionResponsePackets.filingId) })
    .from(evictionResponsePackets)
    .innerJoin(evictionFilings, eq(evictionFilings.id, evictionResponsePackets.filingId))
    .where(gte(evictionFilings.filedAt, since));

  const [outcomeFilingsRow] = await db
    .select({ value: countDistinct(evictionCaseOutcomes.filingId) })
    .from(evictionCaseOutcomes);

  const [defaultJudgmentRow] = await db
    .select({ value: countDistinct(evictionCaseOutcomes.filingId) })
    .from(evictionCaseOutcomes)
    .where(eq(evictionCaseOutcomes.outcome, 'default_judgment'));

  const [favorableRow] = await db
    .select({ value: countDistinct(evictionCaseOutcomes.filingId) })
    .from(evictionCaseOutcomes)
    .where(
      sql`${evictionCaseOutcomes.outcome} IN (${sql.join(
        FAVORABLE_OUTCOMES.map((o) => sql`${o}`),
        sql`, `,
      )})`,
    );

  const safeRatio = (num: number, denom: number) => (denom === 0 ? null : num / denom);

  return {
    representationRate: safeRatio(withPacketRow.value, filingsRow.value),
    defaultJudgmentRate: safeRatio(defaultJudgmentRow.value, outcomeFilingsRow.value),
    favorableOutcomeRate: safeRatio(favorableRow.value, outcomeFilingsRow.value),
  };
}

export async function getDailySeries(windowDays = 30): Promise<DailyPoint[]> {
  const since = daysAgo(windowDays);

  const filingsByDay = await db
    .select({
      day: sql<string>`to_char(${evictionFilings.filedAt} AT TIME ZONE 'UTC', 'YYYY-MM-DD')`,
      value: count(),
    })
    .from(evictionFilings)
    .where(gte(evictionFilings.filedAt, since))
    .groupBy(sql`1`);

  const approvedByDay = await db
    .select({
      day: sql<string>`to_char(${evictionResponsePackets.updatedAt} AT TIME ZONE 'UTC', 'YYYY-MM-DD')`,
      value: count(),
    })
    .from(evictionResponsePackets)
    .where(
      and(
        eq(evictionResponsePackets.status, 'approved'),
        gte(evictionResponsePackets.updatedAt, since),
      ),
    )
    .groupBy(sql`1`);

  // Merge into a contiguous day list so a missing day is 0, not absent.
  const map = new Map<string, DailyPoint>();
  for (let i = 0; i <= windowDays; i++) {
    const d = new Date(since);
    d.setUTCDate(d.getUTCDate() + i);
    const key = d.toISOString().slice(0, 10);
    map.set(key, { day: key, filings: 0, packetsApproved: 0 });
  }
  for (const row of filingsByDay) {
    const point = map.get(row.day);
    if (point) point.filings = row.value;
  }
  for (const row of approvedByDay) {
    const point = map.get(row.day);
    if (point) point.packetsApproved = row.value;
  }
  return Array.from(map.values()).sort((a, b) => a.day.localeCompare(b.day));
}
