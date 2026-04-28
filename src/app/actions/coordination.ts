'use server';

import { and, count, eq, gt } from 'drizzle-orm';
import { revalidatePath } from 'next/cache';
import { db } from '@/db/client';
import { bedCountUpdates, bedHolds, shelters } from '@/db/schema/shelters';
import { logAuditEvent } from '@/lib/audit';
import { requireRole } from '@/lib/auth';
import { validateBedCount } from '@/lib/coordination';

export type UpdateBedCountResult = { ok: true } | { ok: false; error: string };

const STAFF_ROLES = ['shelter_staff', 'admin'] as const;
const HOLD_ROLES = ['caseworker', 'ed_coordinator', 'shelter_staff', 'admin'] as const;

const MAX_NOTE_LEN = 280;
const MAX_PERSON_LABEL_LEN = 80;
/**
 * Soft-hold lifetime. 90 minutes is the working number from the BACKLOG
 * AC for COOR-005 — long enough that someone walking in from across town
 * still has the bed waiting, short enough that no-shows free up beds
 * within the same intake window.
 */
const HOLD_DURATION_MIN = 90;

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

export type CreateBedHoldResult =
  | { ok: true; holdId: string; expiresAt: Date }
  | { ok: false; error: string };

/**
 * Create a 90-minute soft hold against a shelter bed. The hold reserves
 * one effective free bed without changing current_occupancy — the bed
 * isn't physically taken until staff bumps occupancy on arrival.
 *
 * Race protection: we count active+unexpired holds inside the
 * transaction and reject if it would push us above raw free beds. A
 * concurrent second-clicker gets a friendly error instead of an
 * overbooked shelter.
 */
export async function createBedHoldAction(
  shelterId: string,
  personLabel: string,
  notes: string | null,
): Promise<CreateBedHoldResult> {
  const actor = await requireRole(HOLD_ROLES);

  const trimmedLabel = personLabel.trim().slice(0, MAX_PERSON_LABEL_LEN);
  if (trimmedLabel.length === 0) {
    return { ok: false, error: 'Hold label is required (e.g., "211 caller #1234").' };
  }
  const trimmedNotes = notes?.trim() ? notes.trim().slice(0, MAX_NOTE_LEN) : null;

  const expiresAt = new Date(Date.now() + HOLD_DURATION_MIN * 60_000);

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

    const rawFree = shelter.capacity - shelter.currentOccupancy;
    if (rawFree <= 0) return { ok: false as const, error: 'No free beds at this shelter.' };

    const [{ value: activeHolds }] = await tx
      .select({ value: count() })
      .from(bedHolds)
      .where(
        and(
          eq(bedHolds.shelterId, shelterId),
          eq(bedHolds.status, 'active'),
          gt(bedHolds.expiresAt, new Date()),
        ),
      );

    if (Number(activeHolds) >= rawFree) {
      return { ok: false as const, error: 'All free beds are already on hold.' };
    }

    const [created] = await tx
      .insert(bedHolds)
      .values({
        shelterId,
        heldByUserId: actor.id,
        personLabel: trimmedLabel,
        notes: trimmedNotes,
        expiresAt,
      })
      .returning({ id: bedHolds.id, expiresAt: bedHolds.expiresAt });
    return { ok: true as const, holdId: created.id, expiresAt: created.expiresAt };
  });

  if (!result.ok) return result;

  await logAuditEvent({
    actorUserId: actor.id,
    action: 'shelter.bed_hold_created',
    targetTable: 'bed_holds',
    targetId: result.holdId,
    metadata: { shelterId, durationMin: HOLD_DURATION_MIN },
  });

  revalidatePath('/app/coalition/beds');
  revalidatePath('/app/coalition/beds/update');
  return result;
}

export type ReleaseBedHoldResult = { ok: true } | { ok: false; error: string };

const HOLD_TERMINAL_STATUSES = new Set(['released', 'expired', 'converted']);

/**
 * Manually release a hold (typically: caller said "never mind" or
 * staff freed the bed). Only flips status from 'active' → 'released';
 * already-terminal holds return ok without re-flipping.
 */
export async function releaseBedHoldAction(holdId: string): Promise<ReleaseBedHoldResult> {
  const actor = await requireRole(HOLD_ROLES);

  const [hold] = await db
    .select({ id: bedHolds.id, shelterId: bedHolds.shelterId, status: bedHolds.status })
    .from(bedHolds)
    .where(eq(bedHolds.id, holdId))
    .limit(1);
  if (!hold) return { ok: false, error: 'Hold not found.' };

  if (HOLD_TERMINAL_STATUSES.has(hold.status)) {
    return { ok: true };
  }

  await db
    .update(bedHolds)
    .set({ status: 'released', releasedAt: new Date(), updatedAt: new Date() })
    .where(eq(bedHolds.id, holdId));

  await logAuditEvent({
    actorUserId: actor.id,
    action: 'shelter.bed_hold_released',
    targetTable: 'bed_holds',
    targetId: holdId,
    metadata: { shelterId: hold.shelterId, previousStatus: hold.status },
  });

  revalidatePath('/app/coalition/beds');
  revalidatePath('/app/coalition/beds/update');
  return { ok: true };
}
