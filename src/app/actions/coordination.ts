'use server';

import { eq } from 'drizzle-orm';
import { revalidatePath } from 'next/cache';
import { db } from '@/db/client';
import { bedCountUpdates, shelters } from '@/db/schema/shelters';
import { logAuditEvent } from '@/lib/audit';
import { requireRole } from '@/lib/auth';
import { validateBedCount } from '@/lib/coordination/bed-availability';

export type UpdateBedCountResult = { ok: true } | { ok: false; error: string };

const STAFF_ROLES = ['shelter_staff', 'admin'] as const;

const MAX_NOTE_LEN = 280;

/**
 * Set a shelter's current_occupancy to `newOccupancy` and append the
 * change to bed_count_updates. The mutation runs in a transaction so
 * we never end up with a shelters row that disagrees with the audit
 * log.
 *
 * Server-authoritative bounds: clamp to [0, capacity]. The check
 * constraint on shelters would reject anything else, but explicit
 * validation gives a useful error to staff instead of a 500.
 */
export async function updateBedCountAction(
  shelterId: string,
  newOccupancy: number,
  note: string | null,
): Promise<UpdateBedCountResult> {
  const actor = await requireRole(STAFF_ROLES);

  const trimmedNote = note?.trim() ? note.trim().slice(0, MAX_NOTE_LEN) : null;

  const result = await db.transaction(async (tx) => {
    const [shelter] = await tx
      .select({
        id: shelters.id,
        capacity: shelters.capacity,
        currentOccupancy: shelters.currentOccupancy,
        active: shelters.active,
      })
      .from(shelters)
      .where(eq(shelters.id, shelterId))
      .limit(1);
    if (!shelter) return { ok: false as const, error: 'Shelter not found.' };
    if (!shelter.active) return { ok: false as const, error: 'Shelter is inactive.' };
    const validation = validateBedCount(newOccupancy, shelter.capacity);
    if (!validation.ok) return { ok: false as const, error: validation.error };
    if (newOccupancy === shelter.currentOccupancy) {
      return { ok: true as const, noChange: true, previous: shelter.currentOccupancy };
    }

    await tx
      .update(shelters)
      .set({ currentOccupancy: newOccupancy, updatedAt: new Date() })
      .where(eq(shelters.id, shelterId));

    await tx.insert(bedCountUpdates).values({
      shelterId,
      updatedByUserId: actor.id,
      previousOccupancy: shelter.currentOccupancy,
      newOccupancy,
      note: trimmedNote,
    });

    return {
      ok: true as const,
      noChange: false,
      previous: shelter.currentOccupancy,
    };
  });

  if (!result.ok) return result;

  if (!result.noChange) {
    await logAuditEvent({
      actorUserId: actor.id,
      action: 'shelter.bed_count_updated',
      targetTable: 'shelters',
      targetId: shelterId,
      metadata: {
        previousOccupancy: result.previous,
        newOccupancy,
        hasNote: Boolean(trimmedNote),
      },
    });
  }

  revalidatePath('/app/coalition/beds');
  revalidatePath('/app/coalition/beds/update');
  return { ok: true };
}
