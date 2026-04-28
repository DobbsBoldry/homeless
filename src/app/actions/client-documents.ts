'use server';

import * as Sentry from '@sentry/nextjs';
import { eq } from 'drizzle-orm';
import { revalidatePath } from 'next/cache';
import { db } from '@/db/client';
import { clientDocuments } from '@/db/schema/client-documents';
import { type ClientDocumentKind, clientDocumentKindEnum } from '@/db/schema/enums';
import { logAuditEvent } from '@/lib/audit';
import { requireRole } from '@/lib/auth';
import { extractDocument } from '@/lib/cwt';
import { recordAiGeneration } from '@/lib/dtrs';
import { isValidSyntheticPersonRef } from '@/lib/synthetic-person';

export type SaveDocumentInput = {
  kind: ClientDocumentKind;
  label: string;
  contentMd: string;
  syntheticPersonRef?: string | null;
};

export type SaveDocumentResult = { ok: true; id: string } | { ok: false; error: string };

const ROLES = ['caseworker', 'shelter_staff', 'admin'] as const;

const VALID_KINDS = new Set<ClientDocumentKind>(clientDocumentKindEnum.enumValues);

const MAX_LABEL = 80;
const MIN_BODY = 20;
const MAX_BODY = 50_000;

export async function saveClientDocumentAction(
  input: SaveDocumentInput,
): Promise<SaveDocumentResult> {
  const actor = await requireRole(ROLES);

  if (!VALID_KINDS.has(input.kind)) {
    return { ok: false, error: 'Invalid document kind.' };
  }
  const label = input.label.trim().slice(0, MAX_LABEL);
  if (label.length === 0) return { ok: false, error: 'Label is required.' };
  const body = input.contentMd.trim();
  if (body.length < MIN_BODY) {
    return { ok: false, error: `Document body must be at least ${MIN_BODY} chars.` };
  }
  if (body.length > MAX_BODY) {
    return { ok: false, error: `Document body must be under ${MAX_BODY.toLocaleString()} chars.` };
  }
  const ref = input.syntheticPersonRef?.trim() || null;
  if (ref && !isValidSyntheticPersonRef(ref)) {
    return { ok: false, error: 'Invalid synthetic-person reference.' };
  }

  const [created] = await db
    .insert(clientDocuments)
    .values({
      kind: input.kind,
      label,
      contentMd: body,
      syntheticPersonRef: ref,
      uploadedByUserId: actor.id,
      status: 'uploaded',
    })
    .returning({ id: clientDocuments.id });

  await logAuditEvent({
    actorUserId: actor.id,
    action: 'client_document.uploaded',
    targetTable: 'client_documents',
    targetId: created.id,
    metadata: { kind: input.kind, refPresent: ref !== null, bodyChars: body.length },
  });

  revalidatePath('/app/clients/documents');
  return { ok: true, id: created.id };
}

export type ExtractDocumentResult = { ok: true } | { ok: false; error: string };

/**
 * Run AI extraction over an uploaded document. Idempotent — if the
 * row is already in `extracted` state, returns ok. Failure flips
 * status to `failed` so the UI can show a retry button.
 */
export async function extractClientDocumentAction(id: string): Promise<ExtractDocumentResult> {
  const actor = await requireRole(ROLES);

  const [row] = await db
    .select({
      id: clientDocuments.id,
      kind: clientDocuments.kind,
      contentMd: clientDocuments.contentMd,
      status: clientDocuments.status,
    })
    .from(clientDocuments)
    .where(eq(clientDocuments.id, id))
    .limit(1);
  if (!row) return { ok: false, error: 'Document not found.' };
  if (row.status === 'extracted') return { ok: true };

  await db
    .update(clientDocuments)
    .set({ status: 'extracting', updatedAt: new Date() })
    .where(eq(clientDocuments.id, id));

  try {
    const result = await extractDocument(row.kind, row.contentMd);
    await db
      .update(clientDocuments)
      .set({
        status: 'extracted',
        extractedFields: result.fields,
        extractionNotes: result.notes,
        extractionModel: result.modelId,
        updatedAt: new Date(),
      })
      .where(eq(clientDocuments.id, id));

    await recordAiGeneration({
      actorUserId: actor.id,
      resourceType: 'client_documents',
      resourceId: id,
      model: result.modelId,
      promptVersion: result.modelId,
      metadata: { kind: row.kind },
    });

    revalidatePath('/app/clients/documents');
    revalidatePath(`/app/clients/documents/${id}`);
    return { ok: true };
  } catch (err) {
    Sentry.captureException(err, { tags: { action: 'extractClientDocumentAction', id } });
    await db
      .update(clientDocuments)
      .set({ status: 'failed', updatedAt: new Date() })
      .where(eq(clientDocuments.id, id));
    return { ok: false, error: 'Extraction failed. Try again or check the document body.' };
  }
}
