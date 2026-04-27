import { describe, expect, it } from 'vitest';
import type { Shelter } from '@/db/schema/shelters';
import { summarizeBeds } from './bed-summary';

const baseShelter = (over: Partial<Shelter>): Shelter =>
  ({
    id: 'fake-id',
    name: 'Fake Shelter',
    partnerOrgId: 'partner',
    capacity: 10,
    currentOccupancy: 5,
    acceptsMen: true,
    acceptsWomen: true,
    acceptsFamilies: false,
    petFriendly: false,
    sudFriendly: false,
    contactPhone: null,
    streetAddress: null,
    notes: null,
    active: true,
    createdAt: new Date(),
    updatedAt: new Date(),
    ...over,
  }) as Shelter;

describe('summarizeBeds', () => {
  it('returns zeros when no shelters', () => {
    const r = summarizeBeds([], new Map());
    expect(r).toEqual({
      shelterCount: 0,
      totalFree: 0,
      free: { men: 0, women: 0, families: 0, petFriendly: 0, sudFriendly: 0 },
      fullCount: 0,
    });
  });

  it('totals free beds across shelters and slices by population', () => {
    const shelters = [
      // 5 free, men+women only
      baseShelter({ id: 's1', capacity: 10, currentOccupancy: 5 }),
      // 3 free, families + pet
      baseShelter({
        id: 's2',
        capacity: 6,
        currentOccupancy: 3,
        acceptsMen: false,
        acceptsWomen: false,
        acceptsFamilies: true,
        petFriendly: true,
      }),
      // 2 free, women + sud
      baseShelter({
        id: 's3',
        capacity: 4,
        currentOccupancy: 2,
        acceptsMen: false,
        acceptsWomen: true,
        sudFriendly: true,
      }),
    ];
    const r = summarizeBeds(shelters, new Map());
    expect(r.shelterCount).toBe(3);
    expect(r.totalFree).toBe(10);
    expect(r.free.men).toBe(5);
    expect(r.free.women).toBe(7);
    expect(r.free.families).toBe(3);
    expect(r.free.petFriendly).toBe(3);
    expect(r.free.sudFriendly).toBe(2);
    expect(r.fullCount).toBe(0);
  });

  it('subtracts active holds when computing free beds', () => {
    const shelters = [baseShelter({ id: 's1', capacity: 10, currentOccupancy: 5 })];
    const r = summarizeBeds(shelters, new Map([['s1', 3]]));
    // 10 - 5 occupancy - 3 holds = 2
    expect(r.totalFree).toBe(2);
    expect(r.free.men).toBe(2);
    expect(r.fullCount).toBe(0);
  });

  it('counts shelters at zero free as full and skips them in slices', () => {
    const shelters = [
      baseShelter({ id: 'open', capacity: 4, currentOccupancy: 1 }),
      baseShelter({ id: 'full', capacity: 4, currentOccupancy: 4 }),
      baseShelter({ id: 'overheld', capacity: 4, currentOccupancy: 2 }),
    ];
    const holds = new Map([['overheld', 2]]);
    const r = summarizeBeds(shelters, holds);
    expect(r.totalFree).toBe(3);
    expect(r.shelterCount).toBe(3);
    expect(r.fullCount).toBe(2);
  });
});
