'use server';

import * as Sentry from '@sentry/nextjs';
import { revalidatePath } from 'next/cache';
import { recordAgreement } from '@/db/queries/partner-agreements';
import { requireRole } from '@/lib/auth';
import { parsePartnerAgreementForm } from './partner-agreements-parse';

/**
 * Known user-actionable error message prefixes from the domain / query layer.
 * If the thrown error starts with one of these, we surface it verbatim.
 * Everything else gets a generic message (plus Sentry + console for ops visibility).
 */
const KNOWN_DOMAIN_PREFIXES = [
  'FERPA terms',
  'MOU terms',
  'partner_agreements insert',
  'Invalid FERPA scope',
] as const;

export type RecordFerpaAgreementResult =
  | { ok: true; agreementId: string }
  | { ok: false; error: string };

/**
 * Admin-only server action: parse the DTRS-010 FERPA intake FormData and
 * persist via `recordAgreement` (terms validation + audit log happen inside
 * that query function).
 *
 * Parsing is delegated to `parsePartnerAgreementForm` (partner-agreements-parse.ts)
 * so the input validation logic can be unit-tested without Next.js server-action
 * wrapping (STATE.md known quirk).
 */
export async function recordFerpaAgreementAction(
  formData: FormData,
): Promise<RecordFerpaAgreementResult> {
  const user = await requireRole(['admin']);

  const parsed = parsePartnerAgreementForm(formData);
  if (!parsed.ok) return { ok: false, error: parsed.error };

  try {
    const { effectiveDate, endDate, signedByPartner, notes, partnerOrgId, terms } = parsed.input;

    const agreement = await recordAgreement({
      partnerOrgId,
      kind: 'ferpa',
      status: 'active',
      effectiveDate: effectiveDate || null,
      endDate: endDate || null,
      signedByPartner: signedByPartner || null,
      signedByCoalitionUserId: user.id,
      templateVersion: 'ferpa-v1',
      templateRendered: null, // admin can attach the rendered template separately
      terms: terms as Parameters<typeof recordAgreement>[0]['terms'],
      notes: notes || null,
      actorUserId: user.id,
    });

    revalidatePath('/app/admin/agreements/ferpa');
    return { ok: true, agreementId: agreement.id };
  } catch (err) {
    Sentry.captureException(err);
    console.error('[partner-agreements.recordFerpa] failed', err);
    const raw = err instanceof Error ? err.message : '';
    const isKnown = KNOWN_DOMAIN_PREFIXES.some((prefix) =>
      raw.toLowerCase().startsWith(prefix.toLowerCase()),
    );
    const error = isKnown
      ? raw
      : 'Recording the agreement failed — please retry. The error has been logged.';
    return { ok: false, error };
  }
}
