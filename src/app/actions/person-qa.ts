'use server';

import * as Sentry from '@sentry/nextjs';
import { getPersonProfile } from '@/db/queries/person-profile';
import { logAuditEvent } from '@/lib/audit';
import { requireRole } from '@/lib/auth';
import { answerPersonQuestion, type PersonQATurn } from '@/lib/cwt/person-qa';
import { recordAiGeneration } from '@/lib/dtrs/data-access';
import { isValidSyntheticPersonRef } from '@/lib/synthetic-person';

export type AskPersonQuestionResult =
  | { ok: true; answer: string; promptVersion: string }
  | { ok: false; error: string };

const ROLES = ['caseworker', 'shelter_staff', 'ed_coordinator', 'admin'] as const;

const QUESTION_MAX = 1500;
const HISTORY_MAX_TURNS = 30;

export async function askPersonQuestionAction(
  syntheticPersonRef: string,
  history: PersonQATurn[],
): Promise<AskPersonQuestionResult> {
  const actor = await requireRole(ROLES);

  if (!isValidSyntheticPersonRef(syntheticPersonRef)) {
    return { ok: false, error: 'Invalid synthetic-person reference.' };
  }
  if (!Array.isArray(history) || history.length === 0) {
    return { ok: false, error: 'Question is required.' };
  }
  if (history.length > HISTORY_MAX_TURNS) {
    return { ok: false, error: 'Conversation too long — start a new one.' };
  }
  const last = history[history.length - 1];
  if (last.role !== 'user') {
    return { ok: false, error: 'Last turn must be a question.' };
  }
  const q = last.content.trim();
  if (q.length === 0) return { ok: false, error: 'Question is empty.' };
  if (q.length > QUESTION_MAX) {
    return { ok: false, error: `Question too long (max ${QUESTION_MAX} chars).` };
  }

  try {
    const profile = await getPersonProfile(syntheticPersonRef);
    const result = await answerPersonQuestion(profile, history);

    await logAuditEvent({
      actorUserId: actor.id,
      action: 'person_qa.answered',
      targetTable: 'partner_service_events',
      targetId: syntheticPersonRef,
      metadata: {
        promptVersion: result.promptVersion,
        turnCount: history.length,
        questionLen: q.length,
        eventCount: profile.serviceEvents.length,
        intakeCount: profile.intakes.length,
      },
    });
    await recordAiGeneration({
      actorUserId: actor.id,
      resourceType: 'person_qa',
      resourceId: syntheticPersonRef,
      model: result.modelId,
      promptVersion: result.promptVersion,
      metadata: { turnCount: history.length },
    });

    return { ok: true, answer: result.answer, promptVersion: result.promptVersion };
  } catch (err) {
    Sentry.captureException(err, {
      tags: { action: 'askPersonQuestionAction', ref: syntheticPersonRef },
    });
    return { ok: false, error: 'Question answering failed. Try again in a moment.' };
  }
}
