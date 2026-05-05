/**
 * SUBP-005 — KY DOC-DSA runtime gate.
 *
 * Per ADR 0009, every individual-record ingest / read for pre-release
 * subjects must verify that an active KY DOC DSA exists, that the
 * agreement's `individual_records_authorized` flag is true, and that
 * `no_recidivism_prediction_attestation` is true. This module is the
 * single chokepoint.
 *
 * Fail-closed: missing partner_org, missing active agreement, wrong
 * agency, missing attestation, or `individual_records_authorized=false`
 * all throw a typed error (`KyDocGateDeniedError`). Callers that want
 * soft-handling can catch and decide; default behavior is to refuse
 * the operation.
 *
 * Mirrors `dcbs-gate.ts` (SUBP-001 / ADR 0006). The differences are
 * (a) the agency discriminator, (b) the additional attestation check,
 * and (c) the gate also returns the `pre_release_window_days` value
 * because consumers need it for ingest/sweep decisions.
 */

import { getActiveAgreementByKind } from '@/db/queries/partner-agreements';
import type { KyDocDsaTerms } from '@/lib/dtrs';

export type KyDocGateDecision =
  | { allowed: true; agreementId: string; terms: KyDocDsaTerms }
  | { allowed: false; reason: KyDocGateDenyReason };

export type KyDocGateDenyReason =
  | 'no_active_dsa'
  | 'wrong_agency'
  | 'individual_records_not_authorized'
  | 'no_recidivism_prediction_not_attested';

export class KyDocGateDeniedError extends Error {
  reason: KyDocGateDenyReason;
  constructor(reason: KyDocGateDenyReason, message: string) {
    super(message);
    this.name = 'KyDocGateDeniedError';
    this.reason = reason;
  }
}

/**
 * Look up the active KY DOC DSA for a partner_org and decide whether
 * individual-record operations are authorized.
 *
 * Returns a typed decision; does NOT throw. Use
 * `requireKyDocIndividualRecords` for the throw-on-deny variant.
 */
export async function checkKyDocGate(kyDocPartnerOrgId: string): Promise<KyDocGateDecision> {
  const agreement = await getActiveAgreementByKind(kyDocPartnerOrgId, 'dsa');
  if (!agreement) {
    return { allowed: false, reason: 'no_active_dsa' };
  }

  // Narrow JSONB to KyDocDsaTerms via the discriminator.
  const terms = agreement.terms as { kind?: string; agency?: string } & Partial<KyDocDsaTerms>;
  if (terms.kind !== 'dsa' || terms.agency !== 'ky_doc') {
    return { allowed: false, reason: 'wrong_agency' };
  }
  if (terms.individual_records_authorized !== true) {
    return { allowed: false, reason: 'individual_records_not_authorized' };
  }
  // Defense-in-depth — the validator already enforces this when the
  // agreement is recorded, but we re-check at every gate to defend
  // against drift / DB-direct edits.
  if (terms.no_recidivism_prediction_attestation !== true) {
    return { allowed: false, reason: 'no_recidivism_prediction_not_attested' };
  }

  return { allowed: true, agreementId: agreement.id, terms: terms as KyDocDsaTerms };
}

/**
 * Throw-on-deny variant. Use at the boundary of any individual-record
 * ingest path (synthetic seed, future KY DOC feed) and any individual-
 * record read path (caseworker dashboard, handoff action).
 */
export async function requireKyDocIndividualRecords(
  kyDocPartnerOrgId: string,
): Promise<{ agreementId: string; terms: KyDocDsaTerms }> {
  const decision = await checkKyDocGate(kyDocPartnerOrgId);
  if (decision.allowed) return { agreementId: decision.agreementId, terms: decision.terms };

  const messages: Record<KyDocGateDenyReason, string> = {
    no_active_dsa:
      'KY DOC gate denied: no active Data-Sharing Agreement on file for this partner. ' +
      'Record one at /app/admin/agreements/kydoc before ingesting pre-release records.',
    wrong_agency:
      'KY DOC gate denied: the active DSA is not a KY DOC agreement (terms.agency !== "ky_doc"). ' +
      'See ADR 0009 for the privacy contract.',
    individual_records_not_authorized:
      'KY DOC gate denied: the active DSA has individual_records_authorized=false. ' +
      'Update the agreement or remove the pre-release records before retrying.',
    no_recidivism_prediction_not_attested:
      'KY DOC gate denied: the active DSA has no_recidivism_prediction_attestation=false. ' +
      'This is a contract violation (ADR 0009) — re-record the agreement with the attestation checked.',
  };
  throw new KyDocGateDeniedError(decision.reason, messages[decision.reason]);
}
