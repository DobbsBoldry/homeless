// PERF (post-BAA): the array_agg-over-GROUP-BY pattern in
// listSuperUtilizers is fine at Phase-1 scale (synthetic 30-row
// fixture, real Daviess-County volume in the low thousands). At
// 500K+ encounters it will hash-aggregate the whole window — at
// that point migrate to DISTINCT ON (patient_id) CTE for "latest
// row per patient" + a separate count CTE, joined. A composite
// index (patient_id, arrived_at DESC) helps either way.
import { count, desc, eq, gte, max, sql } from 'drizzle-orm';
import { db } from '@/db/client';
import { edEncounters } from '@/db/schema/ed-encounters';
import { HOUSING_INSTABILITY_FLAGS, type SuperUtilizerRow } from '@/lib/esuc';

export interface ListSuperUtilizersOpts {
  /** Minimum number of ED visits in the window to qualify. Default 3. */
  visitsThreshold?: number;
  /** Lookback window in days. Default 180. */
  windowDays?: number;
  /** Cap on rows returned. Default 100. */
  limit?: number;
}

/**
 * One row per qualifying patient: 3+ ED visits in the last 180 days
 * AND a housing-instability signal on the most recent visit. Ordered
 * by visit_count DESC, latest_visit_at DESC (matches the pure
 * comparator in src/lib/esuc/super-utilizer-ranking.ts).
 *
 * Phase-1 strict implementation — `unknown` housing does NOT qualify.
 * When real Epic FHIR data flows in, the housing-status field will
 * sometimes be empty; the borderline case is handled at the case-detail
 * layer, not in the flag list.
 */
export async function listSuperUtilizers(
  opts: ListSuperUtilizersOpts = {},
): Promise<SuperUtilizerRow[]> {
  const { visitsThreshold = 3, windowDays = 180, limit = 100 } = opts;
  const since = new Date();
  since.setDate(since.getDate() - windowDays);

  // We need: visit count, latest visit timestamp, housing status of the
  // latest visit, and chief complaint of the latest visit, all per patient.
  // PG window functions are the cleanest path, but Drizzle's typed DSL
  // doesn't carry a friendly `over()` helper for our case — fall back
  // to a CTE expressed via sql template, which Drizzle parameterizes.
  const housingList = sql.join(
    Array.from(HOUSING_INSTABILITY_FLAGS).map((s) => sql`${s}`),
    sql`, `,
  );

  // 1. Aggregate visit counts and latest_visit_at per patient, in window.
  // 2. Inner-join the latest encounter row by (patient_id, latest_visit_at)
  //    to recover housing_status + chief_complaint of the most recent visit.
  // 3. Filter on visit-count threshold and housing-instability flag.
  const rows = await db
    .select({
      patientId: edEncounters.patientId,
      visitCount: count(edEncounters.id).as('visit_count'),
      latestVisitAt: max(edEncounters.arrivedAt).as('latest_visit_at'),
      // Tie-break on `id` so two encounters at the exact same `arrived_at`
      // produce a deterministic "latest" value across SELECT and HAVING.
      housingStatus: sql<
        SuperUtilizerRow['housingStatus']
      >`(array_agg(${edEncounters.housingStatus} ORDER BY ${edEncounters.arrivedAt} DESC, ${edEncounters.id} DESC))[1]`.as(
        'latest_housing_status',
      ),
      lastChiefComplaint:
        sql<string>`(array_agg(${edEncounters.chiefComplaint} ORDER BY ${edEncounters.arrivedAt} DESC, ${edEncounters.id} DESC))[1]`.as(
          'last_chief_complaint',
        ),
    })
    .from(edEncounters)
    .where(gte(edEncounters.arrivedAt, since))
    .groupBy(edEncounters.patientId)
    .having(
      sql`COUNT(${edEncounters.id}) >= ${visitsThreshold} AND (array_agg(${edEncounters.housingStatus} ORDER BY ${edEncounters.arrivedAt} DESC, ${edEncounters.id} DESC))[1] IN (${housingList})`,
    )
    .orderBy(desc(sql`visit_count`), desc(sql`latest_visit_at`))
    .limit(limit);

  // Drizzle returns Date objects for timestamp columns even via array_agg.
  return rows.map((r) => ({
    patientId: r.patientId,
    visitCount: Number(r.visitCount),
    latestVisitAt:
      r.latestVisitAt instanceof Date
        ? r.latestVisitAt
        : new Date(r.latestVisitAt as unknown as string),
    housingStatus: r.housingStatus,
    lastChiefComplaint: r.lastChiefComplaint,
  }));
}

/**
 * Single-patient: list every ED encounter for the given patient_id,
 * most recent first. Used by the case-detail surface.
 */
export async function listEncountersForPatient(patientId: string) {
  return await db
    .select()
    .from(edEncounters)
    .where(eq(edEncounters.patientId, patientId))
    .orderBy(desc(edEncounters.arrivedAt));
}
