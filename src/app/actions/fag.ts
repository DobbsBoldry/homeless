'use server';

import { eq } from 'drizzle-orm';
import { revalidatePath } from 'next/cache';
import { db } from '@/db/client';
import { type FagMemberStatus, fagMemberStatusEnum } from '@/db/schema/enums';
import { fagCompensationEntries, fagMembers } from '@/db/schema/fag-members';
import { logAuditEvent } from '@/lib/audit';
import { requireRole } from '@/lib/auth';

export type SaveMemberInput = {
  id?: string;
  fullName: string;
  role: string;
  contactPhone?: string | null;
  contactEmail?: string | null;
  hourlyRateCents: number;
  status: FagMemberStatus;
  notes?: string | null;
  onboardedOn?: string | null; // YYYY-MM-DD
};

export type SaveMemberResult = { ok: true; id: string } | { ok: false; error: string };

const ROLES = ['admin'] as const;
const VALID_STATUSES = new Set<FagMemberStatus>(fagMemberStatusEnum.enumValues);

const NAME_MAX = 80;
const ROLE_MAX = 60;
const NOTES_MAX = 500;
const RATE_MAX_CENTS = 100_000; // $1,000/hr cap; sanity bound

export async function saveFagMemberAction(input: SaveMemberInput): Promise<SaveMemberResult> {
  const actor = await requireRole(ROLES);

  const fullName = input.fullName.trim().slice(0, NAME_MAX);
  if (fullName.length === 0) return { ok: false, error: 'Name is required.' };
  const role = input.role.trim().slice(0, ROLE_MAX);
  if (role.length === 0) return { ok: false, error: 'Role label is required.' };
  if (!VALID_STATUSES.has(input.status)) return { ok: false, error: 'Invalid status.' };
  if (
    !Number.isInteger(input.hourlyRateCents) ||
    input.hourlyRateCents < 0 ||
    input.hourlyRateCents > RATE_MAX_CENTS
  ) {
    return { ok: false, error: 'Hourly rate must be 0 – $1,000/hr.' };
  }
  const notes = input.notes?.trim().slice(0, NOTES_MAX) || null;
  const phone = input.contactPhone?.trim() || null;
  const email = input.contactEmail?.trim() || null;
  const onboardedOn = input.onboardedOn?.trim() || null;

  if (input.id) {
    const [updated] = await db
      .update(fagMembers)
      .set({
        fullName,
        role,
        contactPhone: phone,
        contactEmail: email,
        hourlyRateCents: input.hourlyRateCents,
        status: input.status,
        notes,
        onboardedOn,
        updatedAt: new Date(),
      })
      .where(eq(fagMembers.id, input.id))
      .returning({ id: fagMembers.id });
    if (!updated) return { ok: false, error: 'Member not found.' };
    await logAuditEvent({
      actorUserId: actor.id,
      action: 'fag_member.updated',
      targetTable: 'fag_members',
      targetId: updated.id,
    });
    revalidatePath('/app/coalition/fag');
    revalidatePath(`/app/coalition/fag/${updated.id}`);
    return { ok: true, id: updated.id };
  }

  const [created] = await db
    .insert(fagMembers)
    .values({
      fullName,
      role,
      contactPhone: phone,
      contactEmail: email,
      hourlyRateCents: input.hourlyRateCents,
      status: input.status,
      notes,
      onboardedOn,
    })
    .returning({ id: fagMembers.id });
  await logAuditEvent({
    actorUserId: actor.id,
    action: 'fag_member.created',
    targetTable: 'fag_members',
    targetId: created.id,
  });
  revalidatePath('/app/coalition/fag');
  return { ok: true, id: created.id };
}

export type AddEntryInput = {
  memberId: string;
  occurredOn: string; // YYYY-MM-DD
  description: string;
  hoursTenths: number; // 1.5h = 15
  hourlyRateCents?: number; // override; defaults to member's current rate
  notes?: string | null;
};

export type AddEntryResult =
  | { ok: true; id: string; totalCents: number }
  | { ok: false; error: string };

const DESC_MAX = 200;
const HOURS_MAX_TENTHS = 24 * 10; // 24 hours/day cap

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

export async function addFagCompensationEntryAction(input: AddEntryInput): Promise<AddEntryResult> {
  const actor = await requireRole(ROLES);

  if (!DATE_RE.test(input.occurredOn)) return { ok: false, error: 'Date must be YYYY-MM-DD.' };
  const description = input.description.trim().slice(0, DESC_MAX);
  if (description.length === 0) return { ok: false, error: 'Description is required.' };
  if (
    !Number.isInteger(input.hoursTenths) ||
    input.hoursTenths <= 0 ||
    input.hoursTenths > HOURS_MAX_TENTHS
  ) {
    return { ok: false, error: 'Hours must be > 0 and ≤ 24.' };
  }

  const [member] = await db
    .select({ id: fagMembers.id, hourlyRateCents: fagMembers.hourlyRateCents })
    .from(fagMembers)
    .where(eq(fagMembers.id, input.memberId))
    .limit(1);
  if (!member) return { ok: false, error: 'Member not found.' };

  const rate = input.hourlyRateCents ?? member.hourlyRateCents;
  if (!Number.isInteger(rate) || rate < 0 || rate > RATE_MAX_CENTS) {
    return { ok: false, error: 'Invalid hourly rate.' };
  }

  // hoursTenths × cents-per-hour ÷ 10 = cents owed.
  const totalCents = Math.round((input.hoursTenths * rate) / 10);

  const [created] = await db
    .insert(fagCompensationEntries)
    .values({
      memberId: member.id,
      occurredOn: input.occurredOn,
      description,
      hoursTenths: input.hoursTenths,
      hourlyRateCents: rate,
      totalCents,
      notes: input.notes?.trim().slice(0, NOTES_MAX) || null,
    })
    .returning({ id: fagCompensationEntries.id });

  await logAuditEvent({
    actorUserId: actor.id,
    action: 'fag_compensation.created',
    targetTable: 'fag_compensation_entries',
    targetId: created.id,
    metadata: { memberId: member.id, totalCents },
  });

  revalidatePath(`/app/coalition/fag/${member.id}`);
  revalidatePath('/app/coalition/fag');
  return { ok: true, id: created.id, totalCents };
}

export type MarkPaidResult = { ok: true } | { ok: false; error: string };

export async function markFagEntryPaidAction(entryId: string): Promise<MarkPaidResult> {
  const actor = await requireRole(ROLES);

  const [updated] = await db
    .update(fagCompensationEntries)
    .set({ status: 'paid', paidAt: new Date(), paidByUserId: actor.id, updatedAt: new Date() })
    .where(eq(fagCompensationEntries.id, entryId))
    .returning({ id: fagCompensationEntries.id, memberId: fagCompensationEntries.memberId });
  if (!updated) return { ok: false, error: 'Entry not found.' };

  await logAuditEvent({
    actorUserId: actor.id,
    action: 'fag_compensation.paid',
    targetTable: 'fag_compensation_entries',
    targetId: updated.id,
    metadata: { memberId: updated.memberId },
  });

  revalidatePath(`/app/coalition/fag/${updated.memberId}`);
  revalidatePath('/app/coalition/fag');
  return { ok: true };
}
