'use server';

import * as Sentry from '@sentry/nextjs';
import { desc, eq } from 'drizzle-orm';
import { revalidatePath } from 'next/cache';
import type { CaseFacts } from '@/ai/prompts/case-qa';
import { CaseFilingsRoles } from '@/components/eviction/case-filings-roles';
import { db } from '@/db/client';
import { listTriageCandidates } from '@/db/queries/attorney-triage';
import { getFilingById } from '@/db/queries/eviction-filings';
import {
  type EvictionCaseOutcome,
  type EvictionResponsePacketStatus,
  evictionCaseOutcomeEnum,
  evictionResponsePacketStatusEnum,
} from '@/db/schema/enums';
import { evictionCaseOutcomes } from '@/db/schema/eviction-case-outcomes';
import { evictionResponsePackets } from '@/db/schema/eviction-response-packets';
import { logAuditEvent } from '@/lib/audit';
import { requireKlaAttorney, requireRole } from '@/lib/auth';
import { recordAiGeneration } from '@/lib/dtrs/data-access';
import { type AttorneyTriageResult, generateAttorneyTriage } from '@/lib/eviction/attorney-triage';
import { answerCaseQuestion, type CaseQATurn } from '@/lib/eviction/case-qa';
import { renderPacketPdf } from '@/lib/eviction/packet-pdf';
import { generateResponsePacket, validateDisclaimer } from '@/lib/eviction/response-packet';
import { getLatestScore, scoreFiling } from '@/lib/eviction/risk-score';
import { generateOutreachLetter } from '@/lib/eviction/tenant-outreach';

export type ScoreFilingResult = { ok: true } | { ok: false; error: string };

export async function scoreFilingAction(filingId: string): Promise<ScoreFilingResult> {
  await requireRole(CaseFilingsRoles);

  const filing = await getFilingById(filingId);
  if (!filing) return { ok: false, error: 'Filing not found.' };

  try {
    await scoreFiling(filing);
  } catch (err) {
    Sentry.captureException(err, { tags: { action: 'scoreFilingAction', filingId } });
    return { ok: false, error: 'Scoring failed. Please try again.' };
  }

  revalidatePath(`/app/cases/filings/${filingId}`);
  return { ok: true };
}

export type GeneratePacketResult = { ok: true } | { ok: false; error: string };

export async function generatePacketAction(filingId: string): Promise<GeneratePacketResult> {
  const user = await requireKlaAttorney();
  const filing = await getFilingById(filingId);
  if (!filing) return { ok: false, error: 'Filing not found.' };

  try {
    await generateResponsePacket(filing, user.id);
  } catch (err) {
    Sentry.captureException(err, { tags: { action: 'generatePacketAction', filingId } });
    return { ok: false, error: 'Packet generation failed. Please try again.' };
  }

  revalidatePath(`/app/cases/filings/${filingId}/packet`);
  return { ok: true };
}

export type SavePacketResult = { ok: true } | { ok: false; error: string };

export async function savePacketAction(
  packetId: string,
  packetMd: string,
): Promise<SavePacketResult> {
  await requireKlaAttorney();
  if (packetMd.trim().length < 200) {
    return { ok: false, error: 'Packet must be at least 200 characters.' };
  }
  // The disclaimer is non-negotiable — same fragments enforced post-
  // generation in response-packet.ts. Single source of truth.
  const dCheck = validateDisclaimer(packetMd, 'edit');
  if (!dCheck.ok) return { ok: false, error: dCheck.error };
  await db
    .update(evictionResponsePackets)
    .set({ packetMd, updatedAt: new Date() })
    .where(eq(evictionResponsePackets.id, packetId));
  revalidatePath('/app/cases/filings');
  return { ok: true };
}

export type ChangePacketStatusResult = { ok: true } | { ok: false; error: string };

const STATUSES: readonly EvictionResponsePacketStatus[] =
  evictionResponsePacketStatusEnum.enumValues;

/**
 * Allowed transitions per current status. Server-authoritative — don't
 * trust the client's `disabled` rules. `filed` is terminal: once a
 * packet has been filed in court, our DB shouldn't pretend it can be
 * un-filed; correcting a misfile happens out-of-band.
 */
const ALLOWED_TRANSITIONS: Record<
  EvictionResponsePacketStatus,
  readonly EvictionResponsePacketStatus[]
> = {
  draft: ['approved', 'rejected'],
  approved: ['filed', 'rejected', 'draft'],
  filed: [],
  rejected: ['draft'],
};

export async function changePacketStatusAction(
  packetId: string,
  filingId: string,
  newStatus: EvictionResponsePacketStatus,
): Promise<ChangePacketStatusResult> {
  const user = await requireKlaAttorney();
  if (!STATUSES.includes(newStatus)) return { ok: false, error: 'Invalid status.' };

  const [previous] = await db
    .select({ status: evictionResponsePackets.status })
    .from(evictionResponsePackets)
    .where(eq(evictionResponsePackets.id, packetId))
    .limit(1);
  if (!previous) return { ok: false, error: 'Packet not found.' };

  if (!ALLOWED_TRANSITIONS[previous.status].includes(newStatus)) {
    return {
      ok: false,
      error: `Status transition ${previous.status} → ${newStatus} is not allowed.`,
    };
  }

  await db
    .update(evictionResponsePackets)
    .set({ status: newStatus, updatedAt: new Date() })
    .where(eq(evictionResponsePackets.id, packetId));

  await logAuditEvent({
    actorUserId: user.id,
    action: 'response_packet.status_changed',
    targetTable: 'eviction_response_packets',
    targetId: packetId,
    metadata: { from: previous.status, to: newStatus, filingId },
  });

  revalidatePath(`/app/cases/filings/${filingId}/packet`);
  return { ok: true };
}

export type ExportPacketPdfResult =
  | { ok: true; filename: string; base64: string }
  | { ok: false; error: string };

export async function exportPacketPdfAction(packetId: string): Promise<ExportPacketPdfResult> {
  const user = await requireKlaAttorney();
  const [packet] = await db
    .select()
    .from(evictionResponsePackets)
    .where(eq(evictionResponsePackets.id, packetId))
    .limit(1);
  if (!packet) return { ok: false, error: 'Packet not found.' };
  if (packet.status !== 'approved' && packet.status !== 'filed') {
    return { ok: false, error: 'Only approved or filed packets can be exported.' };
  }
  const filing = await getFilingById(packet.filingId);
  if (!filing) return { ok: false, error: 'Filing not found.' };

  let bytes: Buffer;
  try {
    bytes = await renderPacketPdf({ packetMd: packet.packetMd, filing });
  } catch (err) {
    Sentry.captureException(err, { tags: { action: 'exportPacketPdfAction', packetId } });
    return { ok: false, error: 'PDF render failed.' };
  }

  await logAuditEvent({
    actorUserId: user.id,
    action: 'response_packet.exported',
    targetTable: 'eviction_response_packets',
    targetId: packetId,
    metadata: { filingId: filing.id, status: packet.status, sizeBytes: bytes.byteLength },
  });

  const safeCase = filing.caseNumber.replace(/[^a-zA-Z0-9_-]+/g, '-');
  return {
    ok: true,
    filename: `packet-${safeCase}-${packet.id.slice(0, 8)}.pdf`,
    base64: bytes.toString('base64'),
  };
}

export type GenerateOutreachLetterResult =
  | { ok: true; text: string; promptVersion: string }
  | { ok: false; error: string };

export async function generateOutreachLetterAction(
  filingId: string,
): Promise<GenerateOutreachLetterResult> {
  const user = await requireKlaAttorney();
  const filing = await getFilingById(filingId);
  if (!filing) return { ok: false, error: 'Filing not found.' };

  try {
    const result = await generateOutreachLetter(filing);
    await logAuditEvent({
      actorUserId: user.id,
      action: 'outreach_letter.generated',
      targetTable: 'eviction_filings',
      targetId: filing.id,
      metadata: { promptVersion: result.promptVersion, caseNumber: filing.caseNumber },
    });
    await recordAiGeneration({
      actorUserId: user.id,
      resourceType: 'tenant_outreach_letter',
      resourceId: filing.id,
      model: result.modelId,
      promptVersion: result.promptVersion,
      metadata: { caseNumber: filing.caseNumber },
    });
    return { ok: true, text: result.text, promptVersion: result.promptVersion };
  } catch (err) {
    Sentry.captureException(err, { tags: { action: 'generateOutreachLetterAction', filingId } });
    return { ok: false, error: 'Letter generation failed. Please try again.' };
  }
}

export type AskCaseQuestionResult =
  | { ok: true; answer: string; promptVersion: string }
  | { ok: false; error: string };

const QA_USER_QUESTION_MAX = 1500;
const QA_HISTORY_MAX_TURNS = 30;

export async function askCaseQuestionAction(
  filingId: string,
  history: CaseQATurn[],
): Promise<AskCaseQuestionResult> {
  const user = await requireKlaAttorney();

  if (!Array.isArray(history) || history.length === 0) {
    return { ok: false, error: 'Question is required.' };
  }
  if (history.length > QA_HISTORY_MAX_TURNS) {
    return { ok: false, error: 'Conversation too long — start a new one.' };
  }
  const last = history[history.length - 1];
  if (last.role !== 'user') {
    return { ok: false, error: 'Last turn must be a question.' };
  }
  if (last.content.trim().length === 0) {
    return { ok: false, error: 'Question is empty.' };
  }
  if (last.content.length > QA_USER_QUESTION_MAX) {
    return { ok: false, error: `Question too long (max ${QA_USER_QUESTION_MAX} chars).` };
  }

  const filing = await getFilingById(filingId);
  if (!filing) return { ok: false, error: 'Filing not found.' };

  const score = await getLatestScore(filing.id);
  const [latestPacket] = await db
    .select({ status: evictionResponsePackets.status })
    .from(evictionResponsePackets)
    .where(eq(evictionResponsePackets.filingId, filing.id))
    .orderBy(desc(evictionResponsePackets.createdAt))
    .limit(1);
  const [latestOutcome] = await db
    .select({ id: evictionCaseOutcomes.id })
    .from(evictionCaseOutcomes)
    .where(eq(evictionCaseOutcomes.filingId, filing.id))
    .limit(1);

  const facts: CaseFacts = {
    case_number: filing.caseNumber,
    court_division: filing.courtDivision,
    plaintiff: filing.plaintiff,
    defendant_name: `${filing.defendantFirstName} ${filing.defendantLastName}`.trim(),
    cause_type: filing.causeType,
    amount_claimed_cents: filing.amountClaimedCents,
    filed_at: filing.filedAt.toISOString().slice(0, 10),
    status: filing.status,
    risk_score: score?.score ?? null,
    risk_rationale: score?.rationale ?? null,
    risk_model_version: score?.modelVersion ?? null,
    packet_status: latestPacket?.status ?? null,
    outcome_recorded: Boolean(latestOutcome),
  };

  try {
    const result = await answerCaseQuestion(facts, history);

    await logAuditEvent({
      actorUserId: user.id,
      action: 'case_qa.answered',
      targetTable: 'eviction_filings',
      targetId: filing.id,
      metadata: {
        promptVersion: result.promptVersion,
        turnCount: history.length,
        questionLen: last.content.length,
      },
    });
    await recordAiGeneration({
      actorUserId: user.id,
      resourceType: 'case_qa',
      resourceId: filing.id,
      model: result.modelId,
      promptVersion: result.promptVersion,
      metadata: { caseNumber: filing.caseNumber, turnCount: history.length },
    });

    return { ok: true, answer: result.answer, promptVersion: result.promptVersion };
  } catch (err) {
    Sentry.captureException(err, { tags: { action: 'askCaseQuestionAction', filingId } });
    return { ok: false, error: 'Question answering failed. Please try again.' };
  }
}

export type GenerateAttorneyTriageResult =
  | {
      ok: true;
      result: AttorneyTriageResult;
      candidates: Array<{
        filingId: string;
        caseNumber: string;
        amountClaimedCents: number | null;
        score: number | null;
        packetStatus: string | null;
        causeType: string;
        status: string;
        filedAt: string;
      }>;
    }
  | { ok: false; error: string };

export async function generateAttorneyTriageAction(): Promise<GenerateAttorneyTriageResult> {
  const user = await requireKlaAttorney();
  try {
    const candidates = await listTriageCandidates({ windowDays: 30, limit: 20 });
    const result = await generateAttorneyTriage(candidates);

    await logAuditEvent({
      actorUserId: user.id,
      action: 'attorney_triage.generated',
      targetTable: 'eviction_filings',
      metadata: {
        candidateCount: result.candidateCount,
        picksReturned: result.output.picks.length,
      },
    });
    await recordAiGeneration({
      actorUserId: user.id,
      resourceType: 'attorney_triage',
      resourceId: 'morning_triage',
      model: result.modelId,
      promptVersion: result.promptVersion,
      metadata: { candidateCount: result.candidateCount },
    });

    const candidateMeta = candidates.map((c) => ({
      filingId: c.filing.id,
      caseNumber: c.filing.caseNumber,
      amountClaimedCents: c.filing.amountClaimedCents,
      score: c.score,
      packetStatus: c.packetStatus,
      causeType: c.filing.causeType,
      status: c.filing.status,
      filedAt: c.filing.filedAt.toISOString(),
    }));

    return { ok: true, result, candidates: candidateMeta };
  } catch (err) {
    Sentry.captureException(err, { tags: { action: 'generateAttorneyTriageAction' } });
    return { ok: false, error: 'Triage generation failed. Please try again.' };
  }
}

export type RecordCaseOutcomeResult = { ok: true } | { ok: false; error: string };

const OUTCOMES: readonly EvictionCaseOutcome[] = evictionCaseOutcomeEnum.enumValues;

export async function recordCaseOutcomeAction(
  filingId: string,
  outcome: EvictionCaseOutcome,
  notes?: string,
): Promise<RecordCaseOutcomeResult> {
  const user = await requireKlaAttorney();
  if (!OUTCOMES.includes(outcome)) return { ok: false, error: 'Invalid outcome.' };

  const filing = await getFilingById(filingId);
  if (!filing) return { ok: false, error: 'Filing not found.' };

  const trimmed = notes?.trim();
  if (trimmed && trimmed.length > 4000) {
    return { ok: false, error: 'Notes too long (max 4000 characters).' };
  }
  const [row] = await db
    .insert(evictionCaseOutcomes)
    .values({
      filingId,
      outcome,
      notes: trimmed && trimmed.length > 0 ? trimmed : null,
      recordedByUserId: user.id,
    })
    .returning();

  await logAuditEvent({
    actorUserId: user.id,
    action: 'case.outcome_recorded',
    targetTable: 'eviction_case_outcomes',
    targetId: row.id,
    metadata: { filingId, outcome, hasNotes: Boolean(trimmed) },
  });

  revalidatePath(`/app/cases/filings/${filingId}`);
  return { ok: true };
}
