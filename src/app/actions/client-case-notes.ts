'use server';

import * as Sentry from '@sentry/nextjs';
import { revalidatePath } from 'next/cache';
import type { IntakeProfile } from '@/ai/prompts/intake-extraction';
import { db } from '@/db/client';
import { getCaseNoteById } from '@/db/queries/client-case-notes';
import { getPersonProfile } from '@/db/queries/person-profile';
import { type ClientCaseNote, clientCaseNotes } from '@/db/schema/client-case-notes';
import { logAuditEvent } from '@/lib/audit';
import { requireRole } from '@/lib/auth';
import { generateCaseNoteDraft } from '@/lib/cwt';
import { recordAiGeneration } from '@/lib/dtrs';
import { isValidSyntheticPersonRef } from '@/lib/synthetic-person';

export type DraftCaseNoteResult = { ok: true; note: ClientCaseNote } | { ok: false; error: string };

export type SaveCaseNoteEditResult =
  | { ok: true; note: ClientCaseNote }
  | { ok: false; error: string };

const ROLES = ['caseworker', 'shelter_staff', 'ed_coordinator', 'admin'] as const;

const NOTE_MIN = 30;
const NOTE_MAX = 20_000;

/**
 * Generate an AI-drafted case note from the person's structured profile
 * (most recent extracted intake + cross-partner service events) and
 * persist it as a NEW row in `client_case_notes` with `draftedByAi=true`.
 * Returns the row so the UI can render the body in the editor and link
 * the version chain forward when the caseworker saves edits.
 */
export async function draftCaseNoteAction(
  syntheticPersonRef: string,
): Promise<DraftCaseNoteResult> {
  const actor = await requireRole(ROLES);

  if (!isValidSyntheticPersonRef(syntheticPersonRef)) {
    return { ok: false, error: 'Invalid synthetic-person reference.' };
  }

  try {
    const profile = await getPersonProfile(syntheticPersonRef);
    const latestExtracted = profile.intakes.find((i) => i.status === 'extracted') ?? null;
    const intakeProfile = (latestExtracted?.extractedProfile as IntakeProfile | undefined) ?? null;

    const result = await generateCaseNoteDraft({
      syntheticPersonRef,
      profile,
      intakeProfile,
    });

    const [created] = await db
      .insert(clientCaseNotes)
      .values({
        syntheticPersonRef,
        bodyMd: result.bodyMd,
        draftedByAi: true,
        aiModelId: result.modelId,
        aiPromptVersion: result.promptVersion,
        parentNoteId: null,
        createdByUserId: actor.id,
      })
      .returning();

    await logAuditEvent({
      actorUserId: actor.id,
      action: 'case_note.drafted',
      targetTable: 'client_case_notes',
      targetId: created.id,
      metadata: {
        syntheticPersonRef,
        promptVersion: result.promptVersion,
        bodyChars: result.bodyMd.length,
      },
    });
    await recordAiGeneration({
      actorUserId: actor.id,
      resourceType: 'case_note',
      resourceId: created.id,
      model: result.modelId,
      promptVersion: result.promptVersion,
      metadata: { syntheticPersonRef },
    });

    revalidatePath(`/app/clients/person/${syntheticPersonRef}`);
    return { ok: true, note: created };
  } catch (err) {
    Sentry.captureException(err, {
      tags: { action: 'draftCaseNoteAction', ref: syntheticPersonRef },
    });
    return { ok: false, error: 'Note draft failed. Try again in a moment.' };
  }
}

/**
 * Save a caseworker edit as a NEW version of an existing note.
 * `parentNoteId` points at the prior version; we never overwrite — the
 * full edit history is reconstructable by walking parent pointers
 * backward. Drafted-by-AI is false on edits because the human is the
 * author of the change.
 */
export async function saveCaseNoteEditAction(
  parentNoteId: string,
  bodyMd: string,
): Promise<SaveCaseNoteEditResult> {
  const actor = await requireRole(ROLES);

  const trimmed = bodyMd.trim();
  if (trimmed.length < NOTE_MIN) {
    return { ok: false, error: `Note too short (min ${NOTE_MIN} chars).` };
  }
  if (trimmed.length > NOTE_MAX) {
    return { ok: false, error: `Note too long (max ${NOTE_MAX} chars).` };
  }

  const parent = await getCaseNoteById(parentNoteId);
  if (!parent) return { ok: false, error: 'Parent note not found.' };

  if (trimmed === parent.bodyMd.trim()) {
    return { ok: false, error: 'No changes to save.' };
  }

  try {
    const [created] = await db
      .insert(clientCaseNotes)
      .values({
        syntheticPersonRef: parent.syntheticPersonRef,
        bodyMd: trimmed,
        draftedByAi: false,
        aiModelId: null,
        aiPromptVersion: null,
        parentNoteId: parent.id,
        createdByUserId: actor.id,
      })
      .returning();

    await logAuditEvent({
      actorUserId: actor.id,
      action: 'case_note.edited',
      targetTable: 'client_case_notes',
      targetId: created.id,
      metadata: {
        parentNoteId: parent.id,
        syntheticPersonRef: parent.syntheticPersonRef,
        bodyChars: trimmed.length,
        delta: trimmed.length - parent.bodyMd.length,
      },
    });

    revalidatePath(`/app/clients/person/${parent.syntheticPersonRef}`);
    return { ok: true, note: created };
  } catch (err) {
    Sentry.captureException(err, {
      tags: { action: 'saveCaseNoteEditAction', parentNoteId },
    });
    return { ok: false, error: 'Save failed. Try again in a moment.' };
  }
}
