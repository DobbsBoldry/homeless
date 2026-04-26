import type { Shelter } from '@/db/schema/shelters';

export type BedFilter = {
  /** Beds this person needs to fit (logical OR within population). */
  population?: 'men' | 'women' | 'families';
  petFriendly?: boolean;
  sudFriendly?: boolean;
  /** Minimum free beds the shelter must have right now. */
  minFreeBeds?: number;
};

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
 * Empty filter matches every active shelter.
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
): boolean {
  if (filter.population === 'men' && !shelter.acceptsMen) return false;
  if (filter.population === 'women' && !shelter.acceptsWomen) return false;
  if (filter.population === 'families' && !shelter.acceptsFamilies) return false;
  if (filter.petFriendly && !shelter.petFriendly) return false;
  if (filter.sudFriendly && !shelter.sudFriendly) return false;
  if (typeof filter.minFreeBeds === 'number' && freeBeds(shelter) < filter.minFreeBeds) {
    return false;
  }
  return true;
}
