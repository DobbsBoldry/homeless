import type { Shelter } from '@/db/schema/shelters';

export type BedFilter = {
  /** Beds this person needs to fit (logical OR within population). */
  population?: 'men' | 'women' | 'families';
  petFriendly?: boolean;
  sudFriendly?: boolean;
  /** Minimum free beds the shelter must have right now. */
  minFreeBeds?: number;
  /** Free-text query — matches shelter or partner-org name (case-insensitive). */
  query?: string;
};

const VALID_POPULATIONS = ['men', 'women', 'families'] as const;
type Population = (typeof VALID_POPULATIONS)[number];
const isPopulation = (v: unknown): v is Population =>
  typeof v === 'string' && (VALID_POPULATIONS as readonly string[]).includes(v);

/**
 * Parses a `URLSearchParams`-shaped record into a BedFilter, dropping
 * unknown / malformed values. Used by the bed board page to read
 * filters off the URL on the server side.
 *
 * Recognized keys: `population`, `pet=1`, `sud=1`, `minFree`, `q`.
 */
export function parseBedFilterParams(
  params: Record<string, string | string[] | undefined>,
): BedFilter {
  const filter: BedFilter = {};
  const pop = Array.isArray(params.population) ? params.population[0] : params.population;
  if (isPopulation(pop)) filter.population = pop;
  const pet = Array.isArray(params.pet) ? params.pet[0] : params.pet;
  if (pet === '1' || pet === 'true') filter.petFriendly = true;
  const sud = Array.isArray(params.sud) ? params.sud[0] : params.sud;
  if (sud === '1' || sud === 'true') filter.sudFriendly = true;
  const minFreeRaw = Array.isArray(params.minFree) ? params.minFree[0] : params.minFree;
  if (minFreeRaw) {
    const n = Number.parseInt(minFreeRaw, 10);
    if (Number.isInteger(n) && n > 0) filter.minFreeBeds = n;
  }
  const q = Array.isArray(params.q) ? params.q[0] : params.q;
  if (typeof q === 'string' && q.trim().length > 0) filter.query = q.trim().slice(0, 64);
  return filter;
}

/** True when at least one filter dimension is populated. */
export function hasActiveFilter(filter: BedFilter): boolean {
  return Boolean(
    filter.population ||
      filter.petFriendly ||
      filter.sudFriendly ||
      filter.minFreeBeds ||
      filter.query,
  );
}

/** Free beds = capacity − current occupancy. Never negative. */
export function freeBeds(shelter: Pick<Shelter, 'capacity' | 'currentOccupancy'>): number {
  return Math.max(0, shelter.capacity - shelter.currentOccupancy);
}

/** Occupancy rate as a fraction in [0, 1]. Capacity 0 → 1 (treat as full). */
export function occupancyRate(shelter: Pick<Shelter, 'capacity' | 'currentOccupancy'>): number {
  if (shelter.capacity <= 0) return 1;
  return Math.min(1, Math.max(0, shelter.currentOccupancy / shelter.capacity));
}

export type BedCountValidation = { ok: true; value: number } | { ok: false; error: string };

/**
 * Validates a proposed `newOccupancy` against `capacity`. Mirrors what
 * the server action accepts; pulled out as a pure function so unit
 * tests can cover the rule set without spinning up a database.
 */
export function validateBedCount(newOccupancy: number, capacity: number): BedCountValidation {
  if (!Number.isInteger(newOccupancy) || newOccupancy < 0) {
    return { ok: false, error: 'Bed count must be a whole number ≥ 0.' };
  }
  if (capacity < 0) {
    return { ok: false, error: 'Shelter capacity is invalid.' };
  }
  if (newOccupancy > capacity) {
    return { ok: false, error: `Bed count cannot exceed capacity (${capacity}).` };
  }
  return { ok: true, value: newOccupancy };
}

/**
 * True iff a shelter satisfies every populated criterion in `filter`.
 * Empty filter matches every active shelter. The `query` text dimension
 * is checked against `searchableText` (shelter name + partner-org name)
 * when provided — pass `undefined` to skip text matching.
 */
export function matchesFilter(
  shelter: Pick<
    Shelter,
    | 'capacity'
    | 'currentOccupancy'
    | 'acceptsMen'
    | 'acceptsWomen'
    | 'acceptsFamilies'
    | 'petFriendly'
    | 'sudFriendly'
  >,
  filter: BedFilter,
  searchableText?: string,
): boolean {
  if (filter.population === 'men' && !shelter.acceptsMen) return false;
  if (filter.population === 'women' && !shelter.acceptsWomen) return false;
  if (filter.population === 'families' && !shelter.acceptsFamilies) return false;
  if (filter.petFriendly && !shelter.petFriendly) return false;
  if (filter.sudFriendly && !shelter.sudFriendly) return false;
  if (typeof filter.minFreeBeds === 'number' && freeBeds(shelter) < filter.minFreeBeds) {
    return false;
  }
  if (filter.query && filter.query.trim().length > 0) {
    if (!searchableText) return false;
    if (!searchableText.toLowerCase().includes(filter.query.toLowerCase())) return false;
  }
  return true;
}
