'use server';

import { eq } from 'drizzle-orm';
import { revalidatePath } from 'next/cache';
import { db } from '@/db/client';
import { steeringMeetings } from '@/db/schema/steering-meetings';
import { logAuditEvent } from '@/lib/audit';
import { requireRole } from '@/lib/auth';

export type SaveMeetingInput = {
  /** UUID — omit to create a new meeting; pass to edit existing. */
  id?: string;
  title: string;
  heldOn: string; // YYYY-MM-DD
  attendees: Array<{ name: string; affiliation?: string }>;
  agendaMd: string;
  decisionsMd: string;
  actionItemsMd: string;
};

export type SaveMeetingResult = { ok: true; id: string } | { ok: false; error: string };

const ROLES = ['admin', 'attorney', 'caseworker', 'ed_coordinator', 'shelter_staff'] as const;

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

/**
 * Create or update a steering meeting record. Open to any signed-in
 * coalition role — the bar is "you're in the room" not "you have a
 * specific title". Audit trail captures who recorded each version.
 */
export async function saveSteeringMeetingAction(
  input: SaveMeetingInput,
): Promise<SaveMeetingResult> {
  const actor = await requireRole(ROLES);

  const title = input.title.trim();
  if (title.length === 0) return { ok: false, error: 'Title is required.' };
  if (!DATE_RE.test(input.heldOn)) {
    return { ok: false, error: 'Date must be YYYY-MM-DD.' };
  }

  const attendees = input.attendees
    .map((a) => ({
      name: a.name.trim(),
      affiliation: a.affiliation?.trim() || undefined,
    }))
    .filter((a) => a.name.length > 0);

  const values = {
    title,
    heldOn: input.heldOn,
    attendees,
    agendaMd: input.agendaMd.trim(),
    decisionsMd: input.decisionsMd.trim(),
    actionItemsMd: input.actionItemsMd.trim(),
    updatedAt: new Date(),
  };

  if (input.id) {
    const [updated] = await db
      .update(steeringMeetings)
      .set(values)
      .where(eq(steeringMeetings.id, input.id))
      .returning({ id: steeringMeetings.id });
    if (!updated) return { ok: false, error: 'Meeting not found.' };
    await logAuditEvent({
      actorUserId: actor.id,
      action: 'steering_meeting.updated',
      targetTable: 'steering_meetings',
      targetId: updated.id,
      metadata: { heldOn: input.heldOn },
    });
    revalidatePath('/app/coalition/steering');
    revalidatePath(`/app/coalition/steering/${updated.id}`);
    return { ok: true, id: updated.id };
  }

  const [created] = await db
    .insert(steeringMeetings)
    .values({ ...values, createdByUserId: actor.id })
    .returning({ id: steeringMeetings.id });
  await logAuditEvent({
    actorUserId: actor.id,
    action: 'steering_meeting.created',
    targetTable: 'steering_meetings',
    targetId: created.id,
    metadata: { heldOn: input.heldOn },
  });
  revalidatePath('/app/coalition/steering');
  return { ok: true, id: created.id };
}

export type PostMeetingResult = { ok: true } | { ok: false; error: string };

/** Mark minutes as posted (shareable beyond the recorder). One-way. */
export async function postSteeringMeetingAction(id: string): Promise<PostMeetingResult> {
  const actor = await requireRole(ROLES);
  const [updated] = await db
    .update(steeringMeetings)
    .set({ postedAt: new Date(), updatedAt: new Date() })
    .where(eq(steeringMeetings.id, id))
    .returning({ id: steeringMeetings.id });
  if (!updated) return { ok: false, error: 'Meeting not found.' };
  await logAuditEvent({
    actorUserId: actor.id,
    action: 'steering_meeting.posted',
    targetTable: 'steering_meetings',
    targetId: updated.id,
  });
  revalidatePath('/app/coalition/steering');
  revalidatePath(`/app/coalition/steering/${updated.id}`);
  return { ok: true };
}
