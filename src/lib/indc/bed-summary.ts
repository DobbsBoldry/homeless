import type { Shelter } from '@/db/schema/shelters';
import { effectiveFreeBeds } from '@/lib/coordination/bed-availability';

/**
 * Coalition-wide bed summary suitable for a 211 dispatcher or
 * caseworker SMS dashboard. One snapshot, no filters required —
 * gives the dispatcher an at-a-glance read of "what's open right
 * now" plus the population/special-need slices they're most likely
 * to need to triage on the call.
 *
 * Numbers are derived from the same `effectiveFreeBeds` function
 * the bed board uses, so the SMS dashboard and the web view can
 * never disagree about how many free beds exist.
 */
export type BedSummary = {
  shelterCount: number;
  totalFree: number;
  free: {
    men: number;
    women: number;
    families: number;
    petFriendly: number;
    sudFriendly: number;
  };
  /** Shelters with zero free beds right now (after holds). */
  fullCount: number;
};

export function summarizeBeds(
  shelters: Shelter[],
  activeHoldsByShelter: Map<string, number>,
): BedSummary {
  let totalFree = 0;
  let men = 0;
  let women = 0;
  let families = 0;
  let pet = 0;
  let sud = 0;
  let fullCount = 0;

  for (const s of shelters) {
    const free = effectiveFreeBeds(s, activeHoldsByShelter.get(s.id) ?? 0);
    if (free <= 0) {
      fullCount += 1;
      continue;
    }
    totalFree += free;
    if (s.acceptsMen) men += free;
    if (s.acceptsWomen) women += free;
    if (s.acceptsFamilies) families += free;
    if (s.petFriendly) pet += free;
    if (s.sudFriendly) sud += free;
  }

  return {
    shelterCount: shelters.length,
    totalFree,
    free: { men, women, families, petFriendly: pet, sudFriendly: sud },
    fullCount,
  };
}
