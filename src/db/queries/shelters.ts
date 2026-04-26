import { and, asc, count, desc, eq, gt, max } from 'drizzle-orm';
import { db } from '@/db/client';
import { type PartnerOrg, partnerOrgs } from '@/db/schema/partner-orgs';
import {
  type BedCountUpdate,
  type BedHold,
  bedCountUpdates,
  bedHolds,
  type Shelter,
  shelters,
} from '@/db/schema/shelters';
import { users } from '@/db/schema/users';

export type ShelterWithOrg = Shelter & { partnerOrg: Pick<PartnerOrg, 'id' | 'name' | 'slug'> };

/**
 * All active shelters with their owning partner org. Sorted by partner-org
 * name then shelter name to keep the bed board stable across refreshes.
 */
export async function listActiveShelters(): Promise<ShelterWithOrg[]> {
  const rows = await db
    .select({
      shelter: shelters,
      partnerOrg: { id: partnerOrgs.id, name: partnerOrgs.name, slug: partnerOrgs.slug },
    })
    .from(shelters)
    .innerJoin(partnerOrgs, eq(shelters.partnerOrgId, partnerOrgs.id))
    .where(and(eq(shelters.active, true), eq(partnerOrgs.active, true)))
    .orderBy(asc(partnerOrgs.name), asc(shelters.name));

  return rows.map((r) => ({ ...r.shelter, partnerOrg: r.partnerOrg }));
}

export async function getShelterBySlug(slug: string): Promise<ShelterWithOrg | null> {
  const [row] = await db
    .select({
      shelter: shelters,
      partnerOrg: { id: partnerOrgs.id, name: partnerOrgs.name, slug: partnerOrgs.slug },
    })
    .from(shelters)
    .innerJoin(partnerOrgs, eq(shelters.partnerOrgId, partnerOrgs.id))
    .where(eq(shelters.slug, slug))
    .limit(1);
  if (!row) return null;
  return { ...row.shelter, partnerOrg: row.partnerOrg };
}

export async function getShelterById(id: string): Promise<Shelter | null> {
  const [row] = await db.select().from(shelters).where(eq(shelters.id, id)).limit(1);
  return row ?? null;
}

/** Recent bed-count updates for a shelter, newest first. */
export async function listRecentBedCountUpdates(
  shelterId: string,
  limit = 20,
): Promise<BedCountUpdate[]> {
  return await db
    .select()
    .from(bedCountUpdates)
    .where(eq(bedCountUpdates.shelterId, shelterId))
    .orderBy(desc(bedCountUpdates.createdAt))
    .limit(limit);
}

/**
 * Map of shelter id → most recent bed_count_updates.created_at. Used by
 * the staff update UI to show "last updated" alongside each card. Returns
 * `null` for shelters with no updates yet.
 */
export async function lastBedCountUpdateByShelter(): Promise<Map<string, Date | null>> {
  const rows = await db
    .select({
      shelterId: bedCountUpdates.shelterId,
      lastAt: max(bedCountUpdates.createdAt),
    })
    .from(bedCountUpdates)
    .groupBy(bedCountUpdates.shelterId);
  return new Map(rows.map((r) => [r.shelterId, r.lastAt ? new Date(r.lastAt) : null]));
}

/**
 * Count of active, not-yet-expired holds per shelter. The board uses
 * this to show effective free beds (capacity − occupancy − holds).
 */
export async function activeBedHoldCounts(): Promise<Map<string, number>> {
  const now = new Date();
  const rows = await db
    .select({ shelterId: bedHolds.shelterId, value: count() })
    .from(bedHolds)
    .where(and(eq(bedHolds.status, 'active'), gt(bedHolds.expiresAt, now)))
    .groupBy(bedHolds.shelterId);
  return new Map(rows.map((r) => [r.shelterId, Number(r.value)]));
}

export type BedHoldWithHolder = BedHold & {
  heldBy: { firstName: string | null; lastName: string | null; email: string };
};

/** Active (status=active AND expires_at > now) holds for one shelter, newest first. */
export async function listActiveHolds(shelterId: string): Promise<BedHoldWithHolder[]> {
  const now = new Date();
  const rows = await db
    .select({
      hold: bedHolds,
      heldBy: { firstName: users.firstName, lastName: users.lastName, email: users.email },
    })
    .from(bedHolds)
    .innerJoin(users, eq(bedHolds.heldByUserId, users.id))
    .where(
      and(
        eq(bedHolds.shelterId, shelterId),
        eq(bedHolds.status, 'active'),
        gt(bedHolds.expiresAt, now),
      ),
    )
    .orderBy(desc(bedHolds.createdAt));
  return rows.map((r) => ({ ...r.hold, heldBy: r.heldBy }));
}
