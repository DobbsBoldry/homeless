'use server';

import * as Sentry from '@sentry/nextjs';
import { revalidatePath } from 'next/cache';
import { recordAgreement, updateAgreementStatus } from '@/db/queries/partner-agreements';
import { requireRole } from '@/lib/auth';
import type { DcbsDsaTerms, FerpaTerms, MouTerms } from '@/lib/dtrs';
import {
  parseDcbsDsaAgreementForm,
  parseMouAgreementForm,
  parsePartnerAgreementForm,
} from './partner-agreements-parse';

/**
 * Known user-actionable error message prefixes from the domain / query layer.
 * If the thrown error starts with one of these, we surface it verbatim.
 * Everything else gets a generic message (plus Sentry + console for ops visibility).
 */
const KNOWN_DOMAIN_PREFIXES = [
  'FERPA terms',
  'MOU terms',
  'DSA terms',
  'DSA agency',
  'DSA state_contact',
  'DSA data_destruction_due',
  'partner_agreements insert',
  'Invalid FERPA scope',
  'Invalid DCBS-DSA scope',
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
      // parsePartnerAgreementForm validates scope values against the controlled vocab;
      // the narrow cast to FerpaTerms bridges string[] → FerpaScopeValue[].
      // recordAgreement re-validates via validateAgreementTerms before any insert.
      terms: terms as FerpaTerms,
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

export type RecordDcbsDsaAgreementResult =
  | { ok: true; agreementId: string }
  | { ok: false; error: string };

/**
 * Admin-only server action: parse the DTRS-011 DCBS DSA intake FormData and
 * persist via `recordAgreement` (terms validation + audit log happen inside
 * that query function).
 */
export async function recordDcbsDsaAgreementAction(
  formData: FormData,
): Promise<RecordDcbsDsaAgreementResult> {
  const user = await requireRole(['admin']);

  const parsed = parseDcbsDsaAgreementForm(formData);
  if (!parsed.ok) return { ok: false, error: parsed.error };

  try {
    const { effectiveDate, endDate, signedByPartner, notes, partnerOrgId, terms } = parsed.input;

    const agreement = await recordAgreement({
      partnerOrgId,
      kind: 'dsa',
      status: 'active',
      effectiveDate: effectiveDate || null,
      endDate: endDate || null,
      signedByPartner: signedByPartner || null,
      signedByCoalitionUserId: user.id,
      templateVersion: 'dcbs-dsa-v1',
      templateRendered: null,
      // parseDcbsDsaAgreementForm validates scope values against the controlled vocab;
      // the narrow cast to DcbsDsaTerms bridges string[] → DcbsDsaScopeValue[].
      // recordAgreement re-validates via validateAgreementTerms before any insert.
      terms: terms as DcbsDsaTerms,
      notes: notes || null,
      actorUserId: user.id,
    });

    revalidatePath('/app/admin/agreements/dcbs');
    return { ok: true, agreementId: agreement.id };
  } catch (err) {
    Sentry.captureException(err);
    console.error('[partner-agreements.recordDcbsDsa] failed', err);
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

export type RecordMouAgreementResult =
  | { ok: true; agreementId: string }
  | { ok: false; error: string };

/**
 * Admin-only server action: parse the OPRT-002 MOU intake FormData and
 * persist via `recordAgreement` (terms validation + audit log happen inside
 * that query function).
 */
export async function recordMouAgreementAction(
  formData: FormData,
): Promise<RecordMouAgreementResult> {
  const user = await requireRole(['admin']);

  const parsed = parseMouAgreementForm(formData);
  if (!parsed.ok) return { ok: false, error: parsed.error };

  try {
    const { effectiveDate, endDate, signedByPartner, notes, partnerOrgId, terms } = parsed.input;

    const agreement = await recordAgreement({
      partnerOrgId,
      kind: 'mou',
      status: 'active',
      effectiveDate: effectiveDate || null,
      endDate: endDate || null,
      signedByPartner: signedByPartner || null,
      signedByCoalitionUserId: user.id,
      templateVersion: 'mou-v1',
      templateRendered: null,
      terms: terms as MouTerms,
      notes: notes || null,
      actorUserId: user.id,
    });

    revalidatePath('/app/admin/agreements/mou');
    return { ok: true, agreementId: agreement.id };
  } catch (err) {
    Sentry.captureException(err);
    console.error('[partner-agreements.recordMou] failed', err);
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

/**
 * Admin-only: revoke / mark expired / restore an agreement. Used by
 * the admin agreements list pages for status transitions.
 */
export async function updateAgreementStatusAction(
  agreementId: string,
  newStatus: 'draft' | 'active' | 'expired' | 'terminated' | 'superseded',
): Promise<{ ok: true } | { ok: false; error: string }> {
  const user = await requireRole(['admin']);
  try {
    await updateAgreementStatus(agreementId, newStatus, user.id);
    revalidatePath('/app/admin/agreements/mou');
    revalidatePath('/app/admin/agreements/ferpa');
    revalidatePath('/app/admin/agreements/dcbs');
    return { ok: true };
  } catch (err) {
    Sentry.captureException(err);
    return {
      ok: false,
      error: 'Status update failed — please retry. The error has been logged.',
    };
  }
}
