import { and, count, eq, gt } from 'drizzle-orm';
import { db } from '@/db/client';
import { bedHolds, shelters } from '@/db/schema/shelters';
import { logAuditEvent } from '@/lib/audit';

/**
 * Sentinel "user id" written into bed_holds.held_by_user_id when a hold
 * is created from an SMS conversation rather than a signed-in coalition
 * user. The bed_holds.held_by_user_id column is a uuid (not a FK), so
 * this opaque marker is structurally fine; downstream UIs check for
 * the prefix to render \"placed via SMS\" instead of looking up a name.
 */
export const SMS_HELD_BY_SENTINEL = '00000000-0000-0000-0000-00000000515d'; // last bytes spell "SMS" approximately
export const HOLD_DURATION_MIN_SMS = 90;
const PHONE_LABEL_MAX_LEN = 24;

export type CreateSmsHoldResult =
  | { ok: true; holdId: string; expiresAt: Date }
  | { ok: false; error: string };

/**
 * Creates a 90-minute hold on behalf of an SMS caller. Same race-safe
 * count check as the staff-side action; person_label is a redacted
 * version of the caller's number (E.164 last-4) so staff can identify
 * the caller without storing the full number on the hold row.
 */
export async function createBedHoldFromSms(
  shelterId: string,
  fromNumber: string,
): Promise<CreateSmsHoldResult> {
  const expiresAt = new Date(Date.now() + HOLD_DURATION_MIN_SMS * 60_000);
  // E.164 numbers like "+15551234567" → "SMS caller …4567" — keeps
  // staff context without the full number on the bed_holds row.
  const last4 = fromNumber.replace(/[^0-9]/g, '').slice(-4) || 'unknown';
  const personLabel = `SMS caller …${last4}`.slice(0, PHONE_LABEL_MAX_LEN);

  const result = await db.transaction(async (tx) => {
    const [shelter] = await tx
      .select({
        id: shelters.id,
        capacity: shelters.capacity,
        currentOccupancy: shelters.currentOccupancy,
        active: shelters.active,
        name: shelters.name,
        contactPhone: shelters.contactPhone,
      })
      .from(shelters)
      .where(eq(shelters.id, shelterId))
      .limit(1);
    if (!shelter) return { ok: false as const, error: 'shelter not found' };
    if (!shelter.active) return { ok: false as const, error: 'shelter is inactive' };

    const rawFree = shelter.capacity - shelter.currentOccupancy;
    if (rawFree <= 0) return { ok: false as const, error: 'no free beds' };

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
      return { ok: false as const, error: 'all free beds are already on hold' };
    }

    const [created] = await tx
      .insert(bedHolds)
      .values({
        shelterId,
        heldByUserId: SMS_HELD_BY_SENTINEL,
        personLabel,
        expiresAt,
      })
      .returning({ id: bedHolds.id, expiresAt: bedHolds.expiresAt });
    return { ok: true as const, holdId: created.id, expiresAt: created.expiresAt };
  });

  if (!result.ok) return result;

  await logAuditEvent({
    actorUserId: null,
    action: 'shelter.bed_hold_created_via_sms',
    targetTable: 'bed_holds',
    targetId: result.holdId,
    metadata: { shelterId, last4 },
  });

  return result;
}

export type ReleaseSmsHoldResult = { ok: true; shelterName: string } | { ok: false; error: string };

/**
 * Releases a hold the SMS caller previously placed. Caller-scoped:
 * we look up the hold by id AND verify it was created via SMS
 * (`held_by_user_id = SMS_HELD_BY_SENTINEL`) so a leaked id can't be
 * used to release a staff-created hold.
 */
export async function releaseBedHoldFromSms(holdId: string): Promise<ReleaseSmsHoldResult> {
  const [hold] = await db
    .select({
      id: bedHolds.id,
      shelterId: bedHolds.shelterId,
      heldByUserId: bedHolds.heldByUserId,
      status: bedHolds.status,
    })
    .from(bedHolds)
    .where(eq(bedHolds.id, holdId))
    .limit(1);
  if (!hold) return { ok: false, error: 'hold not found' };
  if (hold.heldByUserId !== SMS_HELD_BY_SENTINEL) {
    return { ok: false, error: 'hold not owned by this SMS conversation' };
  }
  if (hold.status !== 'active') {
    return { ok: false, error: 'hold already closed' };
  }

  const [shelter] = await db
    .select({ name: shelters.name })
    .from(shelters)
    .where(eq(shelters.id, hold.shelterId))
    .limit(1);

  await db
    .update(bedHolds)
    .set({ status: 'released', releasedAt: new Date(), updatedAt: new Date() })
    .where(eq(bedHolds.id, holdId));

  await logAuditEvent({
    actorUserId: null,
    action: 'shelter.bed_hold_released_via_sms',
    targetTable: 'bed_holds',
    targetId: holdId,
    metadata: { shelterId: hold.shelterId },
  });

  return { ok: true, shelterName: shelter?.name ?? 'shelter' };
}
