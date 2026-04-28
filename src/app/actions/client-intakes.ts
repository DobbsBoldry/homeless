'use server';

import * as Sentry from '@sentry/nextjs';
import { eq } from 'drizzle-orm';
import { revalidatePath } from 'next/cache';
import { db } from '@/db/client';
import { clientIntakes } from '@/db/schema/client-intakes';
import { logAuditEvent } from '@/lib/audit';
import { requireRole } from '@/lib/auth';
import { extractIntake } from '@/lib/cwt';
import { recordAiGeneration } from '@/lib/dtrs';
import { isValidSyntheticPersonRef } from '@/lib/synthetic-person';

export type SaveIntakeInput = {
  /** Pass for edits; omit to create. */
  id?: string;
  label: string;
  transcriptMd: string;
  syntheticPersonRef?: string | null;
  audioDurationSec?: number | null;
};

export type SaveIntakeResult = { ok: true; id: string } | { ok: false; error: string };

const ROLES = ['caseworker', 'shelter_staff', 'admin'] as const;

const LABEL_MAX = 80;
const TRANSCRIPT_MIN = 20;
const TRANSCRIPT_MAX = 50_000;

export async function saveClientIntakeAction(input: SaveIntakeInput): Promise<SaveIntakeResult> {
  const actor = await requireRole(ROLES);

  const label = input.label.trim().slice(0, LABEL_MAX);
  if (label.length === 0) return { ok: false, error: 'Label is required.' };
  const transcript = input.transcriptMd.trim();
  if (transcript.length < TRANSCRIPT_MIN) {
    return { ok: false, error: `Transcript must be at least ${TRANSCRIPT_MIN} chars.` };
  }
  if (transcript.length > TRANSCRIPT_MAX) {
    return {
      ok: false,
      error: `Transcript must be under ${TRANSCRIPT_MAX.toLocaleString()} chars.`,
    };
  }
  const ref = input.syntheticPersonRef?.trim() || null;
  if (ref && !isValidSyntheticPersonRef(ref)) {
    return { ok: false, error: 'Invalid synthetic-person reference.' };
  }
  const duration =
    input.audioDurationSec != null && Number.isInteger(input.audioDurationSec)
      ? Math.max(0, input.audioDurationSec)
      : null;

  if (input.id) {
    const [updated] = await db
      .update(clientIntakes)
      .set({
        label,
        transcriptMd: transcript,
        syntheticPersonRef: ref,
        audioDurationSec: duration,
        updatedAt: new Date(),
      })
      .where(eq(clientIntakes.id, input.id))
      .returning({ id: clientIntakes.id });
    if (!updated) return { ok: false, error: 'Intake not found.' };
    await logAuditEvent({
      actorUserId: actor.id,
      action: 'client_intake.updated',
      targetTable: 'client_intakes',
      targetId: updated.id,
    });
    revalidatePath('/app/clients/intakes');
    revalidatePath(`/app/clients/intakes/${updated.id}`);
    return { ok: true, id: updated.id };
  }

  const [created] = await db
    .insert(clientIntakes)
    .values({
      label,
      transcriptMd: transcript,
      syntheticPersonRef: ref,
      audioDurationSec: duration,
      recordedByUserId: actor.id,
      status: 'transcribed',
    })
    .returning({ id: clientIntakes.id });

  await logAuditEvent({
    actorUserId: actor.id,
    action: 'client_intake.recorded',
    targetTable: 'client_intakes',
    targetId: created.id,
    metadata: { transcriptChars: transcript.length, audioDurationSec: duration },
  });

  revalidatePath('/app/clients/intakes');
  return { ok: true, id: created.id };
}

export type ExtractIntakeResult = { ok: true } | { ok: false; error: string };

/** Run Claude on the transcript and persist the structured profile. */
export async function extractClientIntakeAction(id: string): Promise<ExtractIntakeResult> {
  const actor = await requireRole(ROLES);

  const [row] = await db
    .select({ id: clientIntakes.id, transcript: clientIntakes.transcriptMd })
    .from(clientIntakes)
    .where(eq(clientIntakes.id, id))
    .limit(1);
  if (!row) return { ok: false, error: 'Intake not found.' };

  await db
    .update(clientIntakes)
    .set({ status: 'extracting', updatedAt: new Date() })
    .where(eq(clientIntakes.id, id));

  try {
    const { profile, modelId } = await extractIntake(row.transcript);
    await db
      .update(clientIntakes)
      .set({
        status: 'extracted',
        extractedProfile: profile as unknown as Record<string, unknown>,
        extractionNotes: profile.notes,
        extractionModel: modelId,
        updatedAt: new Date(),
      })
      .where(eq(clientIntakes.id, id));

    await recordAiGeneration({
      actorUserId: actor.id,
      resourceType: 'client_intakes',
      resourceId: id,
      model: modelId,
      promptVersion: modelId,
    });

    revalidatePath('/app/clients/intakes');
    revalidatePath(`/app/clients/intakes/${id}`);
    return { ok: true };
  } catch (err) {
    Sentry.captureException(err, { tags: { action: 'extractClientIntakeAction', id } });
    await db
      .update(clientIntakes)
      .set({ status: 'failed', updatedAt: new Date() })
      .where(eq(clientIntakes.id, id));
    return { ok: false, error: 'Extraction failed. Try again or check the transcript.' };
  }
}
