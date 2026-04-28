/**
 * PRVN-001 — first-time-homeless classifier.
 *
 * Pure function. Given a chronological sequence of one patient's ED
 * encounters, identifies whether the patient is transitioning to
 * homelessness for the first time on coalition record. The "alert"
 * use case (caseworker outreach before discharge) fires only when:
 *
 *   1. There is a transition encounter (a prior non-homeless encounter
 *      followed by a homeless one), AND
 *   2. The transition encounter is the most recent encounter (the
 *      patient is being discharged into homelessness right now).
 *
 * "Homeless" for this classifier = `housing_status ∈ {shelter, unsheltered}`.
 * `doubled_up` is intentionally excluded — that's housing instability but
 * not the discharge-into-homelessness signal this engine is built to
 * catch. A later story can refine if the alert population needs widening.
 *
 * No DB, no clocks. Tested in isolation; the query layer composes this
 * over patient-by-patient encounter histories.
 */

import type { HousingStatus } from '@/db/schema/enums';

/**
 * Housing statuses that count as "homeless" for the first-time-homeless
 * alert. Stable controlled vocab — change with intent and update tests.
 */
export const HOMELESS_HOUSING_STATUSES: ReadonlyArray<HousingStatus> = ['shelter', 'unsheltered'];

export type EncounterForClassification = {
  id: string;
  arrivedAt: Date;
  housingStatus: HousingStatus;
};

export type FirstTimeHomelessClassification = {
  /** Earliest encounter where housing flipped to homeless. Null if never. */
  transitionEncounterId: string | null;
  /** Timestamp of the transition encounter, or null. */
  transitionAt: Date | null;
  /** Encounters preceding the transition (used to gauge confidence). */
  encountersBefore: number;
  /**
   * True only when the transition encounter is the patient's MOST recent
   * encounter — i.e. they are being discharged into homelessness right
   * now. This is the caseworker-alert trigger.
   */
  isAlertCandidate: boolean;
};

function isHomeless(status: HousingStatus): boolean {
  return HOMELESS_HOUSING_STATUSES.includes(status);
}

export function classifyFirstTimeHomeless(
  encounters: ReadonlyArray<EncounterForClassification>,
): FirstTimeHomelessClassification {
  if (encounters.length === 0) {
    return {
      transitionEncounterId: null,
      transitionAt: null,
      encountersBefore: 0,
      isAlertCandidate: false,
    };
  }

  // Sort chronologically (defensive — callers may pass unsorted).
  const sorted = [...encounters].sort((a, b) => a.arrivedAt.getTime() - b.arrivedAt.getTime());

  // Find the earliest encounter whose housing is homeless.
  const transitionIdx = sorted.findIndex((e) => isHomeless(e.housingStatus));
  if (transitionIdx === -1) {
    return {
      transitionEncounterId: null,
      transitionAt: null,
      encountersBefore: 0,
      isAlertCandidate: false,
    };
  }

  const transitionEncounter = sorted[transitionIdx];
  const isMostRecent = transitionIdx === sorted.length - 1;
  // Alert only when the transition is the MOST recent encounter AND there
  // is at least one prior non-homeless encounter (so we know it's truly a
  // transition, not a chronic state we lack history for).
  const isAlertCandidate = isMostRecent && transitionIdx > 0;

  return {
    transitionEncounterId: transitionEncounter.id,
    transitionAt: transitionEncounter.arrivedAt,
    encountersBefore: transitionIdx,
    isAlertCandidate,
  };
}
