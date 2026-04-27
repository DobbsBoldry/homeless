import { and, desc, eq, gte, inArray, sql } from 'drizzle-orm';
import { RISK_SCORE_MODEL_VERSION } from '@/ai/prompts/eviction-risk-score';
import { db } from '@/db/client';
import type { EvictionFilingStatus, EvictionResponsePacketStatus } from '@/db/schema/enums';
import { evictionCaseOutcomes } from '@/db/schema/eviction-case-outcomes';
import { evictionFilingRiskScores } from '@/db/schema/eviction-filing-risk-scores';
import { type EvictionFiling, evictionFilings } from '@/db/schema/eviction-filings';
import { evictionResponsePackets } from '@/db/schema/eviction-response-packets';

export type TriageCandidate = {
  filing: EvictionFiling;
  score: number | null;
  rationale: string | null;
  packetStatus: EvictionResponsePacketStatus | null;
  hasOutcome: boolean;
};

const OPEN_STATUSES: EvictionFilingStatus[] = ['filed', 'served'];

/**
 * Open cases the attorney could plausibly act on today: filed within
 * the window, status filed/served (i.e. court hasn't entered judgment
 * or the case dismissed yet), joined to current-version risk score,
 * latest packet status, and whether an outcome's been recorded.
 *
 * Filings without a score are included — those are exactly the cases
 * the attorney needs to triage even if the score didn't run yet.
 */
export async function listTriageCandidates(
  opts: { windowDays?: number; limit?: number } = {},
): Promise<TriageCandidate[]> {
  const { windowDays = 30, limit = 20 } = opts;
  const since = new Date();
  since.setDate(since.getDate() - windowDays);

  const rows = await db
    .select({
      filing: evictionFilings,
      score: evictionFilingRiskScores.score,
      rationale: evictionFilingRiskScores.rationale,
    })
    .from(evictionFilings)
    .leftJoin(
      evictionFilingRiskScores,
      and(
        eq(evictionFilingRiskScores.filingId, evictionFilings.id),
        eq(evictionFilingRiskScores.modelVersion, RISK_SCORE_MODEL_VERSION),
      ),
    )
    .where(and(inArray(evictionFilings.status, OPEN_STATUSES), gte(evictionFilings.filedAt, since)))
    .orderBy(
      desc(sql`COALESCE(${evictionFilingRiskScores.score}, 0)`),
      desc(evictionFilings.filedAt),
    )
    .limit(limit);

  if (rows.length === 0) return [];

  const filingIds = rows.map((r) => r.filing.id);

  const [packets, outcomes] = await Promise.all([
    db
      .select({
        filingId: evictionResponsePackets.filingId,
        status: evictionResponsePackets.status,
      })
      .from(evictionResponsePackets)
      .where(inArray(evictionResponsePackets.filingId, filingIds)),
    db
      .select({ filingId: evictionCaseOutcomes.filingId })
      .from(evictionCaseOutcomes)
      .where(inArray(evictionCaseOutcomes.filingId, filingIds)),
  ]);

  const packetByFiling = new Map<string, EvictionResponsePacketStatus>();
  for (const p of packets) packetByFiling.set(p.filingId, p.status);
  const outcomeIds = new Set(outcomes.map((o) => o.filingId));

  return rows.map((r) => ({
    filing: r.filing,
    score: r.score,
    rationale: r.rationale,
    packetStatus: packetByFiling.get(r.filing.id) ?? null,
    hasOutcome: outcomeIds.has(r.filing.id),
  }));
}
