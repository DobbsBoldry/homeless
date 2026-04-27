'use server';

import * as Sentry from '@sentry/nextjs';
import { listEncountersForPatient } from '@/db/queries/ed-encounters';
import { logAuditEvent } from '@/lib/audit';
import { requireRole } from '@/lib/auth';
import { recordAiGeneration } from '@/lib/dtrs/data-access';
import { getCarePlanByPatient } from '@/lib/esuc/care-plan';
import { answerPatientQuestion, type PatientQATurn } from '@/lib/esuc/patient-qa';

export type AskPatientQuestionResult =
  | { ok: true; answer: string; promptVersion: string }
  | { ok: false; error: string };

const ROLES = ['ed_coordinator', 'admin'] as const;

const QUESTION_MAX = 1500;
const HISTORY_MAX_TURNS = 30;

export async function askPatientQuestionAction(
  patientId: string,
  history: PatientQATurn[],
): Promise<AskPatientQuestionResult> {
  const actor = await requireRole(ROLES);

  if (!/^[A-Za-z0-9_-]{6,}$/.test(patientId)) {
    return { ok: false, error: 'Invalid patient identifier.' };
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
    const [encounters, plan] = await Promise.all([
      listEncountersForPatient(patientId),
      getCarePlanByPatient(patientId),
    ]);
    if (encounters.length === 0) {
      return { ok: false, error: 'No encounters on file for this patient.' };
    }

    const result = await answerPatientQuestion({ patientId, encounters, plan }, history);

    await logAuditEvent({
      actorUserId: actor.id,
      action: 'patient_qa.answered',
      targetTable: 'ed_encounters',
      targetId: patientId,
      metadata: {
        promptVersion: result.promptVersion,
        turnCount: history.length,
        questionLen: q.length,
        encounterCount: encounters.length,
      },
    });
    await recordAiGeneration({
      actorUserId: actor.id,
      resourceType: 'patient_qa',
      resourceId: patientId,
      model: result.modelId,
      promptVersion: result.promptVersion,
      metadata: { turnCount: history.length },
    });

    return { ok: true, answer: result.answer, promptVersion: result.promptVersion };
  } catch (err) {
    Sentry.captureException(err, { tags: { action: 'askPatientQuestionAction', patientId } });
    return { ok: false, error: 'Question answering failed. Try again in a moment.' };
  }
}
