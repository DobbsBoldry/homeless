import type { HousingStatus } from '@/db/schema/enums';

export interface SuperUtilizerRow {
  patientId: string;
  visitCount: number;
  latestVisitAt: Date;
  housingStatus: HousingStatus;
  lastChiefComplaint: string;
}

/**
 * Pure comparator mirroring the SQL ORDER BY for the super-utilizer
 * queue: visit_count DESC, latest_visit_at DESC. Exported so tests can
 * verify the rule without a DB roundtrip and so callers building the
 * queue from cached/in-memory rows sort identically to the DB.
 */
export function compareSuperUtilizerRanking(a: SuperUtilizerRow, b: SuperUtilizerRow): number {
  if (a.visitCount !== b.visitCount) return b.visitCount - a.visitCount;
  return b.latestVisitAt.getTime() - a.latestVisitAt.getTime();
}

export function rankSuperUtilizers(rows: SuperUtilizerRow[]): SuperUtilizerRow[] {
  return [...rows].sort(compareSuperUtilizerRanking);
}

/**
 * Housing statuses that qualify a patient for the super-utilizer queue
 * even before the visit threshold is met. Per the Phase-1 strict spec:
 * only documented housing instability counts. `unknown` is excluded
 * from the flag list but visible in the case detail when a borderline
 * patient is being reviewed.
 */
export const HOUSING_INSTABILITY_FLAGS: ReadonlySet<HousingStatus> = new Set<HousingStatus>([
  'shelter',
  'unsheltered',
  'doubled_up',
]);

export function isHousingUnstable(status: HousingStatus): boolean {
  return HOUSING_INSTABILITY_FLAGS.has(status);
}
