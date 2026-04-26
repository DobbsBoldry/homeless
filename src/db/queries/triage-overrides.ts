import { desc, eq, sql } from 'drizzle-orm';
import { db } from '@/db/client';
import { type TriageOverride, triageOverrides } from '@/db/schema/triage-overrides';
import { users } from '@/db/schema/users';

export type TriageOverrideRow = TriageOverride & { actorEmail: string | null };

export async function listRecentTriageOverrides(limit = 50): Promise<TriageOverrideRow[]> {
  const rows = await db
    .select({
      override: triageOverrides,
      actorEmail: users.email,
    })
    .from(triageOverrides)
    .leftJoin(users, eq(triageOverrides.actorUserId, users.id))
    .orderBy(desc(triageOverrides.createdAt))
    .limit(limit);
  return rows.map((r) => ({ ...r.override, actorEmail: r.actorEmail }));
}

export type TriageOverrideStats = {
  total: number;
  overrides: number;
  /** overrides / total. 0 when total === 0. */
  overrideRate: number;
  /** Counts of (recommendedTier → chosenTier) pairs. */
  transitions: Array<{ recommended: string; chosen: string; count: number }>;
};

export async function getTriageOverrideStats(): Promise<TriageOverrideStats> {
  const [totals] = await db.execute<{ total: number; overrides: number }>(sql`
    SELECT
      COUNT(*)::int AS total,
      COUNT(*) FILTER (WHERE recommended_tier <> chosen_tier)::int AS overrides
    FROM ${triageOverrides}
  `);
  const transitions = await db.execute<{ recommended: string; chosen: string; count: number }>(sql`
    SELECT recommended_tier AS recommended, chosen_tier AS chosen, COUNT(*)::int AS count
    FROM ${triageOverrides}
    GROUP BY 1, 2
    ORDER BY count DESC
  `);
  const total = Number(totals.total);
  const overrides = Number(totals.overrides);
  return {
    total,
    overrides,
    overrideRate: total > 0 ? overrides / total : 0,
    transitions: (
      transitions as unknown as Array<{
        recommended: string;
        chosen: string;
        count: number;
      }>
    ).map((r) => ({
      recommended: r.recommended,
      chosen: r.chosen,
      count: Number(r.count),
    })),
  };
}
