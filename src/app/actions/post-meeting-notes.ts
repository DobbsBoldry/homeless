'use server';

import * as Sentry from '@sentry/nextjs';
import { logAuditEvent } from '@/lib/audit';
import { requireRole } from '@/lib/auth';
import {
  type PostMeetingNotesResult,
  structurePostMeetingNotes,
} from '@/lib/cwt/post-meeting-notes';
import { recordAiGeneration } from '@/lib/dtrs/data-access';
import { isValidSyntheticPersonRef } from '@/lib/synthetic-person';

export type StructurePostMeetingNotesResult =
  | {
      ok: true;
      output: PostMeetingNotesResult['output'];
      modelId: string;
      promptVersion: string;
    }
  | { ok: false; error: string };

const ROLES = ['caseworker', 'shelter_staff', 'ed_coordinator', 'admin'] as const;

const NOTES_MIN = 20;
const NOTES_MAX = 10_000;

export async function structurePostMeetingNotesAction(
  syntheticPersonRef: string,
  rawNotes: string,
): Promise<StructurePostMeetingNotesResult> {
  const actor = await requireRole(ROLES);

  if (!isValidSyntheticPersonRef(syntheticPersonRef)) {
    return { ok: false, error: 'Invalid synthetic-person reference.' };
  }
  const trimmed = rawNotes.trim();
  if (trimmed.length < NOTES_MIN) {
    return { ok: false, error: `Notes too short (min ${NOTES_MIN} chars).` };
  }
  if (trimmed.length > NOTES_MAX) {
    return { ok: false, error: `Notes too long (max ${NOTES_MAX} chars).` };
  }

  try {
    const result = await structurePostMeetingNotes(trimmed);

    await logAuditEvent({
      actorUserId: actor.id,
      action: 'post_meeting_notes.structured',
      targetTable: 'partner_service_events',
      targetId: syntheticPersonRef,
      metadata: {
        promptVersion: result.promptVersion,
        rawChars: trimmed.length,
        nextStepsCount: result.output.next_steps.length,
        watchForsCount: result.output.watch_fors.length,
      },
    });
    await recordAiGeneration({
      actorUserId: actor.id,
      resourceType: 'post_meeting_notes',
      resourceId: syntheticPersonRef,
      model: result.modelId,
      promptVersion: result.promptVersion,
      metadata: { rawChars: trimmed.length },
    });

    return {
      ok: true,
      output: result.output,
      modelId: result.modelId,
      promptVersion: result.promptVersion,
    };
  } catch (err) {
    Sentry.captureException(err, {
      tags: { action: 'structurePostMeetingNotesAction', ref: syntheticPersonRef },
    });
    return { ok: false, error: 'Note structuring failed. Try again in a moment.' };
  }
}
