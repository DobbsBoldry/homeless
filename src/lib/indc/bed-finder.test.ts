import { describe, expect, it } from 'vitest';
import type { ShelterWithOrg } from '@/db/queries/shelters';
import { findOpenBeds } from './bed-finder';

const baseShelter = (overrides: Partial<ShelterWithOrg>): ShelterWithOrg => ({
  id: 'sh1',
  partnerOrgId: 'org1',
  name: 'Shelter One',
  slug: 'shelter-one',
  addressLine1: null,
  city: null,
  state: null,
  postalCode: null,
  contactPhone: null,
  capacity: 20,
  currentOccupancy: 10,
  acceptsMen: true,
  acceptsWomen: true,
  acceptsFamilies: false,
  petFriendly: false,
  sudFriendly: false,
  active: true,
  notes: null,
  createdAt: new Date(),
  updatedAt: new Date(),
  partnerOrg: { id: 'org1', name: 'Org One', slug: 'org-one' },
  ...overrides,
});

describe('findOpenBeds', () => {
  it('returns empty when no shelters have free beds', () => {
    expect(
      findOpenBeds({
        shelters: [baseShelter({ currentOccupancy: 20 })],
        filter: { minFreeBeds: 1 },
      }),
    ).toEqual([]);
  });

  it('ranks by free beds descending then name ascending', () => {
    const shelters = [
      baseShelter({ id: 'a', name: 'Alpha', currentOccupancy: 18 }), // 2 free
      baseShelter({ id: 'b', name: 'Bravo', currentOccupancy: 5 }), // 15 free
      baseShelter({ id: 'c', name: 'Charlie', currentOccupancy: 5 }), // 15 free
    ];
    const result = findOpenBeds({ shelters, filter: {} });
    expect(result.map((r) => r.shelter.id)).toEqual(['b', 'c', 'a']);
    expect(result[0].freeBeds).toBe(15);
  });

  it('subtracts active holds from free count', () => {
    const shelters = [baseShelter({ id: 'a', currentOccupancy: 5 })]; // raw 15 free
    const result = findOpenBeds({
      shelters,
      filter: {},
      activeHoldsByShelter: new Map([['a', 4]]),
    });
    expect(result[0].freeBeds).toBe(11);
  });

  it('respects population filter', () => {
    const shelters = [
      baseShelter({ id: 'a', acceptsFamilies: false, currentOccupancy: 5 }),
      baseShelter({ id: 'b', acceptsFamilies: true, currentOccupancy: 5 }),
    ];
    const result = findOpenBeds({ shelters, filter: { population: 'families' } });
    expect(result.map((r) => r.shelter.id)).toEqual(['b']);
  });

  it('caps to limit', () => {
    const shelters = Array.from({ length: 5 }, (_, i) =>
      baseShelter({ id: `s${i}`, name: `Shelter ${i}`, currentOccupancy: 5 + i }),
    );
    expect(findOpenBeds({ shelters, filter: {}, limit: 2 })).toHaveLength(2);
  });
});
