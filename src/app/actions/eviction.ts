'use server';

import * as Sentry from '@sentry/nextjs';
import { desc, eq } from 'drizzle-orm';
import { revalidatePath } from 'next/cache';
import type { CaseFacts } from '@/ai/prompts/case-qa';
import { CaseFilingsRoles } from '@/components/eviction/case-filings-roles';
import { db } from '@/db/client';
import { listTriageCandidates } from '@/db/queries/attorney-triage';
import {
  getFilingById,
  listTopPlaintiffsRecent,
  type TopPlaintiff,
} from '@/db/queries/eviction-filings';
import { clientIntakes } from '@/db/schema/client-intakes';
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
import { renderOutreachLetterPdf } from '@/lib/eviction/outreach-letter-pdf';
import { renderPacketPdf } from '@/lib/eviction/packet-pdf';
import { commentOnPlaintiffPatterns } from '@/lib/eviction/plaintiff-patterns';
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

export type ExportOutreachLetterPdfResult =
  | { ok: true; filename: string; base64: string }
  | { ok: false; error: string };

const OUTREACH_PDF_TEXT_MIN = 80;
const OUTREACH_PDF_TEXT_MAX = 5000;

export async function exportOutreachLetterPdfAction(
  filingId: string,
  letterText: string,
): Promise<ExportOutreachLetterPdfResult> {
  const user = await requireKlaAttorney();
  const filing = await getFilingById(filingId);
  if (!filing) return { ok: false, error: 'Filing not found.' };

  const trimmed = letterText.trim();
  if (trimmed.length < OUTREACH_PDF_TEXT_MIN) {
    return { ok: false, error: `Letter too short (min ${OUTREACH_PDF_TEXT_MIN} chars).` };
  }
  if (trimmed.length > OUTREACH_PDF_TEXT_MAX) {
    return { ok: false, error: `Letter too long (max ${OUTREACH_PDF_TEXT_MAX} chars).` };
  }

  let bytes: Buffer;
  try {
    bytes = await renderOutreachLetterPdf({ letterText: trimmed, filing });
  } catch (err) {
    Sentry.captureException(err, { tags: { action: 'exportOutreachLetterPdfAction', filingId } });
    return { ok: false, error: 'PDF render failed.' };
  }

  await logAuditEvent({
    actorUserId: user.id,
    action: 'outreach_letter.pdf_exported',
    targetTable: 'eviction_filings',
    targetId: filing.id,
    metadata: {
      caseNumber: filing.caseNumber,
      sizeBytes: bytes.byteLength,
      letterChars: trimmed.length,
    },
  });

  const safeCase = filing.caseNumber.replace(/[^a-zA-Z0-9_-]+/g, '-');
  return {
    ok: true,
    filename: `outreach-${safeCase}.pdf`,
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

export type ReferToCaseworkerResult =
  | { ok: true; intakeId: string; alreadyExisted: boolean }
  | { ok: false; error: string };

const fmtMoneyForReferral = (cents: number | null): string => {
  if (cents == null) return 'an unspecified amount';
  return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(cents / 100);
};

const causeNarrative: Record<string, string> = {
  non_payment: 'non-payment of rent',
  lease_violation: 'a lease violation',
  holdover: 'holdover (lease ended, tenant remained)',
  other: 'an unspecified cause',
};

/**
 * KLA attorney sees a filing they can't fully serve alone (benefits
 * gap, care plan, shelter risk) and refers the defendant to the
 * caseworker queue. We spawn a `client_intakes` row with a templated
 * narrative the caseworker reads before meeting the client. The
 * caseworker can edit the transcript and run the existing extraction
 * pipeline; the intake then flows through the regular chain
 * (extraction → screener → person view).
 *
 * Idempotent: if a referral intake already exists for this filing
 * (label suffix `· EVDT-REF · {filing.id}`), we return its id rather
 * than creating a duplicate.
 */
export async function referFilingToCaseworkerAction(
  filingId: string,
): Promise<ReferToCaseworkerResult> {
  const user = await requireKlaAttorney();
  const filing = await getFilingById(filingId);
  if (!filing) return { ok: false, error: 'Filing not found.' };

  const refTag = `EVDT-REF:${filing.id}`;

  const [existing] = await db
    .select({ id: clientIntakes.id })
    .from(clientIntakes)
    .where(eq(clientIntakes.label, refTag))
    .limit(1);
  if (existing) {
    return { ok: true, intakeId: existing.id, alreadyExisted: true };
  }

  const filedDate = filing.filedAt.toISOString().slice(0, 10);
  const cause = causeNarrative[filing.causeType] ?? 'an unspecified cause';
  const amount = fmtMoneyForReferral(filing.amountClaimedCents);

  const narrative = [
    'Referral from Kentucky Legal Aid (KLA — Owensboro Office).',
    '',
    `${filing.defendantFirstName} was named in eviction case ${filing.caseNumber}, filed ${filedDate} by ${filing.plaintiff}. The cause is ${cause} and the amount claimed is ${amount}. The case is currently in "${filing.status}" status.`,
    '',
    "We're referring this person here for benefits screening, possible care planning, and any other support the coalition can offer. KLA may take the legal side of this case independently.",
    '',
    "We have not yet contacted the tenant directly. When you meet them, please bring up the eviction proactively — many tenants don't realize free legal help is available. Run the benefits screener; SNAP and KCHIP are likely worth checking given the financial stress of an active filing. If they're paying any rent at all today, encourage them to keep receipts.",
    '',
    `(Edit this transcript with what the client tells you, then run extraction. Or replace it entirely with a fresh intake recording — your call.)`,
  ].join('\n');

  try {
    const [created] = await db
      .insert(clientIntakes)
      .values({
        label: refTag,
        transcriptMd: narrative,
        recordedByUserId: user.id,
        status: 'transcribed',
      })
      .returning({ id: clientIntakes.id });

    await logAuditEvent({
      actorUserId: user.id,
      action: 'eviction.referred_to_caseworker',
      targetTable: 'eviction_filings',
      targetId: filing.id,
      metadata: {
        intakeId: created.id,
        caseNumber: filing.caseNumber,
      },
    });

    return { ok: true, intakeId: created.id, alreadyExisted: false };
  } catch (err) {
    Sentry.captureException(err, { tags: { action: 'referFilingToCaseworkerAction', filingId } });
    return { ok: false, error: 'Referral failed. Please try again.' };
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

export type BatchOutreachItem =
  | { ok: true; filingId: string; text: string; promptVersion: string }
  | { ok: false; filingId: string; error: string };

export type GenerateBatchOutreachResult =
  | { ok: true; items: BatchOutreachItem[] }
  | { ok: false; error: string };

const BATCH_OUTREACH_MAX = 8;

/**
 * Run `generateOutreachLetter` for a list of filing ids in parallel.
 * Used by the attorney morning-triage page to draft outreach for
 * every pick at once. Failures are per-item so a single bad filing
 * id (or an Anthropic glitch) doesn't fail the batch.
 */
export async function generateOutreachLettersBatchAction(
  filingIds: string[],
): Promise<GenerateBatchOutreachResult> {
  const user = await requireKlaAttorney();

  if (!Array.isArray(filingIds) || filingIds.length === 0) {
    return { ok: false, error: 'No filings provided.' };
  }
  if (filingIds.length > BATCH_OUTREACH_MAX) {
    return {
      ok: false,
      error: `Batch too large (max ${BATCH_OUTREACH_MAX}). Run triage and try again.`,
    };
  }
  const seen = new Set<string>();
  const unique = filingIds.filter((id) => {
    if (seen.has(id)) return false;
    seen.add(id);
    return true;
  });

  const settled = await Promise.allSettled(
    unique.map(async (filingId): Promise<BatchOutreachItem> => {
      const filing = await getFilingById(filingId);
      if (!filing) return { ok: false, filingId, error: 'Filing not found.' };
      try {
        const result = await generateOutreachLetter(filing);
        await logAuditEvent({
          actorUserId: user.id,
          action: 'outreach_letter.generated',
          targetTable: 'eviction_filings',
          targetId: filing.id,
          metadata: {
            promptVersion: result.promptVersion,
            caseNumber: filing.caseNumber,
            via: 'triage_batch',
          },
        });
        await recordAiGeneration({
          actorUserId: user.id,
          resourceType: 'tenant_outreach_letter',
          resourceId: filing.id,
          model: result.modelId,
          promptVersion: result.promptVersion,
          metadata: { caseNumber: filing.caseNumber, via: 'triage_batch' },
        });
        return { ok: true, filingId, text: result.text, promptVersion: result.promptVersion };
      } catch (err) {
        Sentry.captureException(err, {
          tags: { action: 'generateOutreachLettersBatchAction', filingId },
        });
        return { ok: false, filingId, error: 'Letter generation failed.' };
      }
    }),
  );

  const items: BatchOutreachItem[] = settled.map((s, i) => {
    if (s.status === 'fulfilled') return s.value;
    return { ok: false, filingId: unique[i], error: 'Unexpected failure.' };
  });

  return { ok: true, items };
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

export type CommentOnPlaintiffPatternsResult =
  | {
      ok: true;
      text: string;
      modelId: string;
      promptVersion: string;
      plaintiffs: TopPlaintiff[];
      windowDays: number;
      minCount: number;
    }
  | { ok: false; error: string };

const PATTERN_WINDOW_DAYS = 30;
const PATTERN_MIN_COUNT = 3;
const PATTERN_LIMIT = 10;

export async function commentOnPlaintiffPatternsAction(): Promise<CommentOnPlaintiffPatternsResult> {
  const user = await requireRole(CaseFilingsRoles);

  try {
    const plaintiffs = await listTopPlaintiffsRecent({
      windowDays: PATTERN_WINDOW_DAYS,
      minCount: PATTERN_MIN_COUNT,
      limit: PATTERN_LIMIT,
    });
    const result = await commentOnPlaintiffPatterns({
      windowDays: PATTERN_WINDOW_DAYS,
      minCount: PATTERN_MIN_COUNT,
      plaintiffs,
    });

    await logAuditEvent({
      actorUserId: user.id,
      action: 'plaintiff_patterns.commented',
      targetTable: 'eviction_filings',
      metadata: {
        promptVersion: result.promptVersion,
        windowDays: PATTERN_WINDOW_DAYS,
        minCount: PATTERN_MIN_COUNT,
        plaintiffCount: plaintiffs.length,
      },
    });
    await recordAiGeneration({
      actorUserId: user.id,
      resourceType: 'plaintiff_patterns',
      resourceId: 'docket_window',
      model: result.modelId,
      promptVersion: result.promptVersion,
      metadata: { windowDays: PATTERN_WINDOW_DAYS },
    });

    return {
      ok: true,
      text: result.text,
      modelId: result.modelId,
      promptVersion: result.promptVersion,
      plaintiffs,
      windowDays: PATTERN_WINDOW_DAYS,
      minCount: PATTERN_MIN_COUNT,
    };
  } catch (err) {
    Sentry.captureException(err, { tags: { action: 'commentOnPlaintiffPatternsAction' } });
    return { ok: false, error: 'Pattern detection failed. Please try again.' };
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
