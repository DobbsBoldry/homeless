import type { ShelterWithOrg } from '@/db/queries/shelters';
import { type BedFilter, effectiveFreeBeds, matchesFilter } from '@/lib/coordination';

export type BedFinderResult = {
  shelter: ShelterWithOrg;
  freeBeds: number;
};

export type BedFinderInput = {
  shelters: readonly ShelterWithOrg[];
  /** Map of shelter id → active hold count. Defaults to 0 per shelter. */
  activeHoldsByShelter?: Map<string, number>;
  filter: BedFilter;
  /** Maximum results to return; SMS replies cap at 3 to fit in one segment. */
  limit?: number;
};

/**
 * Returns the top `limit` shelters that satisfy the filter and have at
 * least one effective free bed (capacity − occupied − holds), ranked
 * by free beds descending then name ascending.
 *
 * Pure function — caller fetches the data; this just ranks.
 */
export function findOpenBeds(input: BedFinderInput): BedFinderResult[] {
  const limit = input.limit ?? 3;
  const holds = input.activeHoldsByShelter ?? new Map<string, number>();

  const candidates: BedFinderResult[] = [];
  for (const shelter of input.shelters) {
    const free = effectiveFreeBeds(shelter, holds.get(shelter.id) ?? 0);
    if (free <= 0) continue;
    if (!matchesFilter(shelter, input.filter, `${shelter.name} ${shelter.partnerOrg.name}`)) {
      continue;
    }
    candidates.push({ shelter, freeBeds: free });
  }

  candidates.sort((a, b) => {
    if (b.freeBeds !== a.freeBeds) return b.freeBeds - a.freeBeds;
    return a.shelter.name.localeCompare(b.shelter.name);
  });

  return candidates.slice(0, limit);
}
