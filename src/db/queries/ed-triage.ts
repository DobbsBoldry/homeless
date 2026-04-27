import { desc, inArray } from 'drizzle-orm';
import { db } from '@/db/client';
import type { EsucCarePlanStatus } from '@/db/schema/enums';
import { esucCarePlans } from '@/db/schema/esuc-care-plans';
import type { SuperUtilizerRow } from '@/lib/esuc/super-utilizer-ranking';
import { listSuperUtilizers } from './ed-encounters';

export type EdTriageCandidate = SuperUtilizerRow & {
  carePlanStatus: EsucCarePlanStatus | null;
};

/**
 * Pull the current super-utilizer queue and join each patient's most
 * recent care-plan status. The AI uses both signals: visit volume +
 * housing flag tells the queue who's burning the system; care-plan
 * presence/status tells it where coordinator action is blocked or
 * already done.
 */
export async function listEdTriageCandidates(
  opts: { windowDays?: number; limit?: number } = {},
): Promise<EdTriageCandidate[]> {
  const candidates = await listSuperUtilizers({
    windowDays: opts.windowDays ?? 180,
    limit: opts.limit ?? 20,
  });
  if (candidates.length === 0) return [];

  const patientIds = candidates.map((c) => c.patientId);
  const planRows = await db
    .select({ patientId: esucCarePlans.patientId, status: esucCarePlans.status })
    .from(esucCarePlans)
    .where(inArray(esucCarePlans.patientId, patientIds))
    .orderBy(desc(esucCarePlans.createdAt));

  const latestPlanByPatient = new Map<string, EsucCarePlanStatus>();
  for (const row of planRows) {
    if (!latestPlanByPatient.has(row.patientId)) {
      latestPlanByPatient.set(row.patientId, row.status);
    }
  }

  return candidates.map((c) => ({
    ...c,
    carePlanStatus: latestPlanByPatient.get(c.patientId) ?? null,
  }));
}
