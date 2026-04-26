'use server';

import * as Sentry from '@sentry/nextjs';
import { eq } from 'drizzle-orm';
import { revalidatePath } from 'next/cache';
import { RESPONSE_PACKET_DISCLAIMER_PREFIX } from '@/ai/prompts/eviction-response-packet';
import { CaseFilingsRoles } from '@/components/eviction/case-filings-roles';
import { db } from '@/db/client';
import { getFilingById } from '@/db/queries/eviction-filings';
import {
  type EvictionResponsePacketStatus,
  evictionResponsePacketStatusEnum,
} from '@/db/schema/enums';
import { evictionResponsePackets } from '@/db/schema/eviction-response-packets';
import { logAuditEvent } from '@/lib/audit';
import { requireKlaAttorney, requireRole } from '@/lib/auth';
import { generateResponsePacket } from '@/lib/eviction/response-packet';
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
  // The disclaimer is non-negotiable — refuse to save a packet that has
  // had it stripped or substantially edited away.
  if (
    !packetMd.includes(RESPONSE_PACKET_DISCLAIMER_PREFIX) ||
    !packetMd.includes('not legal advice')
  ) {
    return {
      ok: false,
      error: 'Disclaimer block must be preserved verbatim — restore it before saving.',
    };
  }
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
