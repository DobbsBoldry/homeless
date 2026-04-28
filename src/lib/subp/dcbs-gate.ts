/**
 * SUBP-001 — DCBS-DSA runtime gate.
 *
 * Per ADR 0006, every individual-record ingest / read for foster youth
 * must verify that an active DCBS DSA exists *and* that the agreement's
 * `individual_records_authorized` flag is true. This module is the
 * single chokepoint.
 *
 * Fail-closed: missing partner_org, missing active agreement, wrong
 * agency, or `individual_records_authorized=false` all throw a typed
 * error (`DcbsGateDeniedError`). Callers that want soft-handling can
 * catch and decide; default behavior is to refuse the operation.
 */

import { getActiveAgreementByKind } from '@/db/queries/partner-agreements';
import type { DcbsDsaTerms } from '@/lib/dtrs';

export type DcbsGateDecision =
  | { allowed: true; agreementId: string; terms: DcbsDsaTerms }
  | { allowed: false; reason: DcbsGateDenyReason };

export type DcbsGateDenyReason =
  | 'no_active_dsa'
  | 'wrong_agency'
  | 'individual_records_not_authorized';

export class DcbsGateDeniedError extends Error {
  reason: DcbsGateDenyReason;
  constructor(reason: DcbsGateDenyReason, message: string) {
    super(message);
    this.name = 'DcbsGateDeniedError';
    this.reason = reason;
  }
}

/**
 * Look up the active DCBS DSA for a partner_org and decide whether
 * individual-record operations are authorized.
 *
 * Returns a typed decision; does NOT throw. Use `requireDcbsIndividualRecords`
 * for the throw-on-deny variant.
 */
export async function checkDcbsGate(dcbsPartnerOrgId: string): Promise<DcbsGateDecision> {
  const agreement = await getActiveAgreementByKind(dcbsPartnerOrgId, 'dsa');
  if (!agreement) {
    return { allowed: false, reason: 'no_active_dsa' };
  }

  // Narrow JSONB to DcbsDsaTerms via the discriminator.
  const terms = agreement.terms as { kind?: string; agency?: string } & Partial<DcbsDsaTerms>;
  if (terms.kind !== 'dsa' || terms.agency !== 'dcbs') {
    return { allowed: false, reason: 'wrong_agency' };
  }
  if (terms.individual_records_authorized !== true) {
    return { allowed: false, reason: 'individual_records_not_authorized' };
  }

  return { allowed: true, agreementId: agreement.id, terms: terms as DcbsDsaTerms };
}

/**
 * Throw-on-deny variant. Use at the boundary of any individual-record
 * ingest path (synthetic seed, future DCBS feed) and any individual-record
 * read path (caseworker dashboard, alert acknowledgement).
 */
export async function requireDcbsIndividualRecords(
  dcbsPartnerOrgId: string,
): Promise<{ agreementId: string; terms: DcbsDsaTerms }> {
  const decision = await checkDcbsGate(dcbsPartnerOrgId);
  if (decision.allowed) return { agreementId: decision.agreementId, terms: decision.terms };

  const messages: Record<DcbsGateDenyReason, string> = {
    no_active_dsa:
      'DCBS gate denied: no active Data-Sharing Agreement on file for this partner. ' +
      'Record one at /app/admin/agreements/dcbs before ingesting youth records.',
    wrong_agency:
      'DCBS gate denied: the active DSA is not a DCBS agreement (terms.agency !== "dcbs"). ' +
      'See ADR 0006 for the privacy contract.',
    individual_records_not_authorized:
      'DCBS gate denied: the active DSA has individual_records_authorized=false. ' +
      'Update the agreement or remove the youth records before retrying.',
  };
  throw new DcbsGateDeniedError(decision.reason, messages[decision.reason]);
}
