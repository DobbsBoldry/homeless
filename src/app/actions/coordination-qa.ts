'use server';

import * as Sentry from '@sentry/nextjs';
import { getCoalitionWeeklyDigest } from '@/db/queries/coalition-weekly-digest';
import { logAuditEvent } from '@/lib/audit';
import { requireRole } from '@/lib/auth';
import {
  answerCoordinationQuestion,
  type CoordinationQATurn,
} from '@/lib/coalition/coordination-qa';
import { recordAiGeneration } from '@/lib/dtrs/data-access';

export type AskCoordinationQuestionResult =
  | { ok: true; answer: string; promptVersion: string }
  | { ok: false; error: string };

const ROLES = ['attorney', 'caseworker', 'ed_coordinator', 'shelter_staff', 'admin'] as const;

const QUESTION_MAX = 1500;
const HISTORY_MAX_TURNS = 30;
const WINDOW_DAYS = 14;

export async function askCoordinationQuestionAction(
  history: CoordinationQATurn[],
): Promise<AskCoordinationQuestionResult> {
  const actor = await requireRole(ROLES);

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
    const digest = await getCoalitionWeeklyDigest({ windowDays: WINDOW_DAYS });
    const result = await answerCoordinationQuestion(digest, history);

    await logAuditEvent({
      actorUserId: actor.id,
      action: 'coordination_qa.answered',
      targetTable: 'partner_service_events',
      metadata: {
        promptVersion: result.promptVersion,
        turnCount: history.length,
        questionLen: q.length,
        crossOrgCount: digest.crossOrgTouchpoints.length,
        windowDays: WINDOW_DAYS,
      },
    });
    await recordAiGeneration({
      actorUserId: actor.id,
      resourceType: 'coordination_qa',
      resourceId: 'cross_org_view',
      model: result.modelId,
      promptVersion: result.promptVersion,
      metadata: { turnCount: history.length, windowDays: WINDOW_DAYS },
    });

    return { ok: true, answer: result.answer, promptVersion: result.promptVersion };
  } catch (err) {
    Sentry.captureException(err, { tags: { action: 'askCoordinationQuestionAction' } });
    return { ok: false, error: 'Question answering failed. Try again in a moment.' };
  }
}
