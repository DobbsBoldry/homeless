'use server';

import * as Sentry from '@sentry/nextjs';
import { eq } from 'drizzle-orm';
import { revalidatePath } from 'next/cache';
import { CaseFilingsRoles } from '@/components/eviction/case-filings-roles';
import { db } from '@/db/client';
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
import { renderPacketPdf } from '@/lib/eviction/packet-pdf';
import { generateResponsePacket, validateDisclaimer } from '@/lib/eviction/response-packet';
import { scoreFiling } from '@/lib/eviction/risk-score';

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
