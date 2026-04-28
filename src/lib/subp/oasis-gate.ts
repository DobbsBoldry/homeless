/**
 * SUBP-004 — OASIS-DSA runtime gate.
 *
 * Per ADR 0007, every individual-record ingest / read for DV survivors
 * must verify that an active OASIS DSA exists for the partner_org. This
 * module is the single chokepoint at the partner-org level — the
 * abuser-blind middleware (`abuser-blind.ts`) layers per-row authorization
 * on top.
 *
 * Fail-closed: missing partner_org, missing active agreement, or wrong
 * agency all throw `OasisGateDeniedError`. Callers wanting soft-handling
 * use `checkOasisGate` (no throw); default behavior is `requireOasisDsa`.
 *
 * The DSA's `terms.redaction_policy` is returned alongside the gate
 * decision so callers can apply per-field redaction without a second
 * round-trip.
 */

import { getActiveOasisDsa } from '@/db/queries/partner-agreements';
import type { OasisDsaTerms } from '@/lib/dtrs';

export type OasisGateDecision =
  | { allowed: true; agreementId: string; terms: OasisDsaTerms }
  | { allowed: false; reason: OasisGateDenyReason };

export type OasisGateDenyReason = 'no_active_dsa' | 'wrong_agency' | 'no_attestation';

export class OasisGateDeniedError extends Error {
  reason: OasisGateDenyReason;
  constructor(reason: OasisGateDenyReason, message: string) {
    super(message);
    this.name = 'OasisGateDeniedError';
    this.reason = reason;
  }
}

/**
 * Look up the active OASIS DSA for a partner_org and decide whether
 * survivor-record operations are authorized.
 *
 * Returns a typed decision; does NOT throw. Use `requireOasisDsa` for
 * the throw-on-deny variant.
 */
export async function checkOasisGate(oasisPartnerOrgId: string): Promise<OasisGateDecision> {
  const agreement = await getActiveOasisDsa(oasisPartnerOrgId);
  if (!agreement) {
    return { allowed: false, reason: 'no_active_dsa' };
  }

  // Narrow JSONB to OasisDsaTerms via the discriminator.
  const terms = agreement.terms as { kind?: string; agency?: string } & Partial<OasisDsaTerms>;
  if (terms.kind !== 'dsa' || terms.agency !== 'oasis') {
    return { allowed: false, reason: 'wrong_agency' };
  }
  if (terms.abuser_blind_attestation !== true) {
    // Defense-in-depth: the validator already enforces this at insert
    // time (ADR 0007 § Decision rule 2), but a post-hoc DB tamper or a
    // future weakened path would be caught here.
    return { allowed: false, reason: 'no_attestation' };
  }

  return { allowed: true, agreementId: agreement.id, terms: terms as OasisDsaTerms };
}

/**
 * Throw-on-deny variant. Use at the boundary of any survivor-record
 * ingest path (synthetic seed, future OASIS feed) and any survivor-record
 * read path (advocate dashboard, safety-event timeline).
 */
export async function requireOasisDsa(
  oasisPartnerOrgId: string,
): Promise<{ agreementId: string; terms: OasisDsaTerms }> {
  const decision = await checkOasisGate(oasisPartnerOrgId);
  if (decision.allowed) return { agreementId: decision.agreementId, terms: decision.terms };

  const messages: Record<OasisGateDenyReason, string> = {
    no_active_dsa:
      'OASIS gate denied: no active Data-Sharing Agreement on file for this partner. ' +
      'Record one at /app/admin/agreements/oasis before reading survivor records.',
    wrong_agency:
      'OASIS gate denied: the active DSA is not an OASIS agreement (terms.agency !== "oasis"). ' +
      'See ADR 0007 for the privacy contract.',
    no_attestation:
      'OASIS gate denied: the active DSA is missing abuser-blind attestation. ' +
      'This should not happen — investigate as a potential data integrity incident.',
  };

  throw new OasisGateDeniedError(decision.reason, messages[decision.reason]);
}
