/**
 * COOR-012 — handoff context reader.
 *
 * Single chokepoint for the receiving caseworker to actually fetch the
 * transferred records. Enforces all four gates on every call:
 *
 *   1. Handoff status is `accepted`.
 *   2. Requesting user is a member of the receiving partner org
 *      (`org_memberships`).
 *   3. The linked `person_partner_consents` row is unrevoked AND its
 *      grant timestamp is on or before the accept timestamp (so a
 *      revoke-then-regrant doesn't accidentally re-authorise a prior
 *      accept).
 *   4. Each returned record kind is in the handoff's `requested_scope`.
 *
 * Audit-log writes one `case_handoff.context_read` row per call, with
 * the kinds returned and the count per kind. Failure modes also audit
 * (`case_handoff.context_denied`) so a coordinator forensic review sees
 * attempted reads that didn't satisfy a gate.
 */

import { and, asc, desc, eq, isNull } from 'drizzle-orm';
import { db } from '@/db/client';
import {
  getCaseHandoff,
  getPersonPartnerConsent,
  userBelongsToOrg,
} from '@/db/queries/case-handoffs';
import type { CaseHandoff } from '@/db/schema/case-handoffs';
import { type ClientCaseNote, clientCaseNotes } from '@/db/schema/client-case-notes';
import { type ClientIntake, clientIntakes } from '@/db/schema/client-intakes';
import { type Consent, consents } from '@/db/schema/consents';
import type { CaseHandoffScopeKind } from '@/db/schema/enums';
import { type PartnerServiceEvent, partnerServiceEvents } from '@/db/schema/partner-service-events';
import { logAuditEvent } from '@/lib/audit';

export type HandoffContextDenyReason =
  | 'not_found'
  | 'not_accepted'
  | 'not_receiver_member'
  | 'consent_missing'
  | 'consent_revoked'
  | 'consent_pre_dates_accept';

export class HandoffContextDeniedError extends Error {
  reason: HandoffContextDenyReason;
  constructor(reason: HandoffContextDenyReason, message: string) {
    super(message);
    this.name = 'HandoffContextDeniedError';
    this.reason = reason;
  }
}

export interface HandoffContext {
  handoff: CaseHandoff;
  intakes: ClientIntake[];
  caseNotes: ClientCaseNote[];
  serviceEvents: PartnerServiceEvent[];
  /**
   * Subject's coalition-wide consents (the `consents` table), filtered by
   * `subject_external_id === handoff.synthetic_person_ref` and unrevoked.
   * Useful context for the receiver — they need to know what the subject
   * has authorised.
   */
  consents: Consent[];
}

interface ConsentValidationInput {
  consentId: string | null;
  acceptedAt: Date | null;
  syntheticPersonRef: string;
  toPartnerOrgId: string;
}

interface ConsentRecord {
  id: string;
  syntheticPersonRef: string;
  partnerOrgId: string;
  grantedAt: Date;
  revokedAt: Date | null;
}

/**
 * Pure consent validator — no DB. Exercised directly by tests; the live
 * loader passes the row it just fetched.
 */
export function validateConsentForRead(
  input: ConsentValidationInput,
  consent: ConsentRecord | null,
): { allowed: true } | { allowed: false; reason: HandoffContextDenyReason } {
  if (!input.consentId || !consent) {
    return { allowed: false, reason: 'consent_missing' };
  }
  if (consent.revokedAt !== null) {
    return { allowed: false, reason: 'consent_revoked' };
  }
  if (consent.syntheticPersonRef !== input.syntheticPersonRef) {
    return { allowed: false, reason: 'consent_missing' };
  }
  if (consent.partnerOrgId !== input.toPartnerOrgId) {
    return { allowed: false, reason: 'consent_missing' };
  }
  if (input.acceptedAt && consent.grantedAt > input.acceptedAt) {
    return { allowed: false, reason: 'consent_pre_dates_accept' };
  }
  return { allowed: true };
}

/**
 * Fetch the transferred context for a receiver caseworker.
 *
 * Throws `HandoffContextDeniedError` on any gate failure (with audit
 * logged). Returns the scoped record set on success (also audited).
 */
export async function loadHandoffContext(
  handoffId: string,
  requestingUserId: string,
): Promise<HandoffContext> {
  const handoff = await getCaseHandoff(handoffId);
  if (!handoff) {
    await auditDeny(handoffId, requestingUserId, 'not_found', null);
    throw new HandoffContextDeniedError('not_found', `Handoff ${handoffId} not found.`);
  }

  if (handoff.status !== 'accepted') {
    await auditDeny(handoffId, requestingUserId, 'not_accepted', handoff);
    throw new HandoffContextDeniedError(
      'not_accepted',
      `Handoff ${handoffId} is in status '${handoff.status}'; context is only readable when accepted.`,
    );
  }

  const isMember = await userBelongsToOrg(requestingUserId, handoff.toPartnerOrgId);
  if (!isMember) {
    await auditDeny(handoffId, requestingUserId, 'not_receiver_member', handoff);
    throw new HandoffContextDeniedError(
      'not_receiver_member',
      'Requesting user is not a member of the receiving partner org.',
    );
  }

  const consentRow = handoff.consentId ? await getPersonPartnerConsent(handoff.consentId) : null;
  const consentDecision = validateConsentForRead(
    {
      consentId: handoff.consentId,
      acceptedAt: handoff.acceptedAt,
      syntheticPersonRef: handoff.syntheticPersonRef,
      toPartnerOrgId: handoff.toPartnerOrgId,
    },
    consentRow,
  );
  if (!consentDecision.allowed) {
    await auditDeny(handoffId, requestingUserId, consentDecision.reason, handoff);
    throw new HandoffContextDeniedError(
      consentDecision.reason,
      `Handoff ${handoffId}: consent gate denied (${consentDecision.reason}).`,
    );
  }

  const scope = new Set(handoff.requestedScope);
  const result: HandoffContext = {
    handoff,
    intakes: scope.has('intakes') ? await fetchIntakes(handoff.syntheticPersonRef) : [],
    caseNotes: scope.has('case_notes') ? await fetchCaseNotes(handoff.syntheticPersonRef) : [],
    serviceEvents: scope.has('service_events')
      ? await fetchServiceEvents(handoff.syntheticPersonRef)
      : [],
    consents: scope.has('consents') ? await fetchConsents(handoff.syntheticPersonRef) : [],
  };

  await logAuditEvent({
    actorUserId: requestingUserId,
    action: 'case_handoff.context_read',
    targetTable: 'case_handoffs',
    targetId: handoffId,
    metadata: {
      synthetic_person_ref: handoff.syntheticPersonRef,
      to_partner_org_id: handoff.toPartnerOrgId,
      scope: handoff.requestedScope,
      counts: {
        intakes: result.intakes.length,
        case_notes: result.caseNotes.length,
        service_events: result.serviceEvents.length,
        consents: result.consents.length,
      },
    },
  });

  return result;
}

// ---------------------------------------------------------------------------
// Per-kind fetchers (deep `db` use is acceptable here — these are the leaf
// readers, not the gate logic that tests need to mock).
// ---------------------------------------------------------------------------

async function fetchIntakes(syntheticPersonRef: string): Promise<ClientIntake[]> {
  return db
    .select()
    .from(clientIntakes)
    .where(eq(clientIntakes.syntheticPersonRef, syntheticPersonRef))
    .orderBy(desc(clientIntakes.createdAt));
}

async function fetchCaseNotes(syntheticPersonRef: string): Promise<ClientCaseNote[]> {
  return db
    .select()
    .from(clientCaseNotes)
    .where(eq(clientCaseNotes.syntheticPersonRef, syntheticPersonRef))
    .orderBy(desc(clientCaseNotes.createdAt));
}

async function fetchServiceEvents(syntheticPersonRef: string): Promise<PartnerServiceEvent[]> {
  return db
    .select()
    .from(partnerServiceEvents)
    .where(eq(partnerServiceEvents.syntheticPersonRef, syntheticPersonRef))
    .orderBy(desc(partnerServiceEvents.eventAt));
}

async function fetchConsents(syntheticPersonRef: string): Promise<Consent[]> {
  return db
    .select()
    .from(consents)
    .where(and(eq(consents.subjectExternalId, syntheticPersonRef), isNull(consents.revokedAt)))
    .orderBy(asc(consents.grantedAt));
}

async function auditDeny(
  handoffId: string,
  requestingUserId: string,
  reason: HandoffContextDenyReason,
  handoff: CaseHandoff | null,
): Promise<void> {
  await logAuditEvent({
    actorUserId: requestingUserId,
    action: 'case_handoff.context_denied',
    targetTable: 'case_handoffs',
    targetId: handoffId,
    metadata: {
      reason,
      status: handoff?.status,
      to_partner_org_id: handoff?.toPartnerOrgId,
      synthetic_person_ref: handoff?.syntheticPersonRef,
    },
  });
}

/**
 * Subset of the scope kinds returned for a given handoff. Useful for UI
 * surfaces that want to render "X intakes, Y notes" without re-fetching.
 */
export function summarizeScope(scope: readonly CaseHandoffScopeKind[]): {
  intakes: boolean;
  case_notes: boolean;
  service_events: boolean;
  consents: boolean;
} {
  const set = new Set(scope);
  return {
    intakes: set.has('intakes'),
    case_notes: set.has('case_notes'),
    service_events: set.has('service_events'),
    consents: set.has('consents'),
  };
}
