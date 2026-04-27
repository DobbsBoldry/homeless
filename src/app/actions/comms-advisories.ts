'use server';

import { eq } from 'drizzle-orm';
import { revalidatePath } from 'next/cache';
import { db } from '@/db/client';
import { commsAdvisories } from '@/db/schema/comms-advisories';
import { logAuditEvent } from '@/lib/audit';
import { requireRole } from '@/lib/auth';

export type PostAdvisoryInput = {
  title: string;
  bodyMd: string;
  spokespersonName: string;
  spokespersonContact?: string | null;
};

export type PostAdvisoryResult = { ok: true; id: string } | { ok: false; error: string };

const ROLES = ['admin', 'attorney', 'caseworker', 'ed_coordinator', 'shelter_staff'] as const;

const TITLE_MAX = 120;
const BODY_MAX = 4000;
const NAME_MAX = 80;
const CONTACT_MAX = 80;

/**
 * Post a new comms advisory. Implicitly ends any currently-active
 * advisory — there's only one canonical "speak with one voice"
 * statement at a time.
 */
export async function postCommsAdvisoryAction(
  input: PostAdvisoryInput,
): Promise<PostAdvisoryResult> {
  const actor = await requireRole(ROLES);

  const title = input.title.trim().slice(0, TITLE_MAX);
  const bodyMd = input.bodyMd.trim().slice(0, BODY_MAX);
  const spokesperson = input.spokespersonName.trim().slice(0, NAME_MAX);
  if (title.length === 0) return { ok: false, error: 'Title is required.' };
  if (bodyMd.length === 0) return { ok: false, error: 'Statement / talking points are required.' };
  if (spokesperson.length === 0) {
    return { ok: false, error: 'Designate a spokesperson by name.' };
  }
  const contact = input.spokespersonContact?.trim().slice(0, CONTACT_MAX) || null;

  const created = await db.transaction(async (tx) => {
    // End any currently active advisory first.
    await tx
      .update(commsAdvisories)
      .set({ active: false, endedAt: new Date(), endedByUserId: actor.id, updatedAt: new Date() })
      .where(eq(commsAdvisories.active, true));

    const [row] = await tx
      .insert(commsAdvisories)
      .values({
        title,
        bodyMd,
        spokespersonName: spokesperson,
        spokespersonContact: contact,
        postedByUserId: actor.id,
      })
      .returning({ id: commsAdvisories.id });
    return row;
  });

  await logAuditEvent({
    actorUserId: actor.id,
    action: 'comms_advisory.posted',
    targetTable: 'comms_advisories',
    targetId: created.id,
    metadata: { spokesperson },
  });

  revalidatePath('/app', 'layout');
  return { ok: true, id: created.id };
}

export type EndAdvisoryResult = { ok: true } | { ok: false; error: string };

/** End the active advisory. Idempotent on already-ended rows. */
export async function endCommsAdvisoryAction(id: string): Promise<EndAdvisoryResult> {
  const actor = await requireRole(ROLES);

  const [updated] = await db
    .update(commsAdvisories)
    .set({ active: false, endedAt: new Date(), endedByUserId: actor.id, updatedAt: new Date() })
    .where(eq(commsAdvisories.id, id))
    .returning({ id: commsAdvisories.id });
  if (!updated) return { ok: false, error: 'Advisory not found.' };

  await logAuditEvent({
    actorUserId: actor.id,
    action: 'comms_advisory.ended',
    targetTable: 'comms_advisories',
    targetId: updated.id,
  });

  revalidatePath('/app', 'layout');
  return { ok: true };
}
