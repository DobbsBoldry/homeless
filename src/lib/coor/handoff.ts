/**
 * COOR-012 — inter-agency handoff state machine.
 *
 * Pure-ish state transitions plus the two governance gates:
 *   1. Both partner orgs must be active (`partner_orgs.active=true`) AND
 *      have at least one active `partner_agreements` row with the
 *      coalition. This is the *governance* gate.
 *   2. The receiver must hold an unrevoked `person_partner_consents`
 *      grant for the subject's `synthetic_person_ref`. This is the
 *      *subject* gate. It can land either before or after the request
 *      (a handoff sits in `pending_consent` until the grant exists).
 *
 * Reads of transferred context are NOT done here — see
 * `handoff-context.ts`. This module only manages the handoff record.
 *
 * Audit-log calls are non-optional. Every state transition writes one row.
 * DB I/O is delegated to `@/db/queries/case-handoffs` so the gate logic
 * can be exercised under `vi.mock` without a Postgres instance.
 */

import { db } from '@/db/client';
import {
  getActivePersonPartnerConsent,
  getCaseHandoff,
  insertCaseHandoff,
  loadOrgGateState,
  updateCaseHandoff,
} from '@/db/queries/case-handoffs';
import type { CaseHandoff, NewCaseHandoff } from '@/db/schema/case-handoffs';
import type { CaseHandoffScopeKind, CaseHandoffStatus } from '@/db/schema/enums';
import { logAuditEvent } from '@/lib/audit';

/** Default soft-expiration window for pre-acceptance handoffs. */
export const DEFAULT_HANDOFF_TTL_DAYS = 30;

const VALID_SCOPE_KINDS: ReadonlySet<CaseHandoffScopeKind> = new Set([
  'intakes',
  'case_notes',
  'service_events',
  'consents',
]);

export type HandoffGateDenyReason =
  | 'unknown_from_org'
  | 'unknown_to_org'
  | 'same_org'
  | 'from_org_inactive'
  | 'to_org_inactive'
  | 'from_org_no_active_agreement'
  | 'to_org_no_active_agreement'
  | 'empty_scope'
  | 'invalid_scope_kind';

export class HandoffGateDeniedError extends Error {
  reason: HandoffGateDenyReason;
  constructor(reason: HandoffGateDenyReason, message: string) {
    super(message);
    this.name = 'HandoffGateDeniedError';
    this.reason = reason;
  }
}

export type HandoffStateError =
  | 'not_found'
  | 'wrong_state_for_consent'
  | 'wrong_state_for_accept'
  | 'wrong_state_for_decline'
  | 'wrong_state_for_revoke'
  | 'consent_org_mismatch'
  | 'consent_revoked'
  | 'consent_subject_mismatch';

export class HandoffStateMachineError extends Error {
  reason: HandoffStateError;
  constructor(reason: HandoffStateError, message: string) {
    super(message);
    this.name = 'HandoffStateMachineError';
    this.reason = reason;
  }
}

// ---------------------------------------------------------------------------
// Pure helpers (no DB)
// ---------------------------------------------------------------------------

/**
 * Validate the requested-scope array. Throws `HandoffGateDeniedError` on
 * empty array or unknown kind. Pure — no DB.
 */
export function validateRequestedScope(scope: readonly string[]): CaseHandoffScopeKind[] {
  if (!Array.isArray(scope) || scope.length === 0) {
    throw new HandoffGateDeniedError(
      'empty_scope',
      'Handoff requested_scope must be a non-empty array of CaseHandoffScopeKind values.',
    );
  }
  const seen = new Set<CaseHandoffScopeKind>();
  for (const kind of scope) {
    if (!VALID_SCOPE_KINDS.has(kind as CaseHandoffScopeKind)) {
      throw new HandoffGateDeniedError(
        'invalid_scope_kind',
        `Unknown handoff scope kind: ${JSON.stringify(kind)}.`,
      );
    }
    seen.add(kind as CaseHandoffScopeKind);
  }
  return [...seen];
}

/** Compute the expiration timestamp for a freshly-initiated handoff. */
export function computeExpiresAt(now: Date, ttlDays = DEFAULT_HANDOFF_TTL_DAYS): Date {
  const out = new Date(now);
  out.setUTCDate(out.getUTCDate() + ttlDays);
  return out;
}

/**
 * Pure status transition rules. Returns the next status given the current
 * state and the event, or null when the transition is not legal. Used by
 * both the live state machine and the Inngest sweep.
 */
export function nextStatus(
  current: CaseHandoffStatus,
  event: 'consent_recorded' | 'accept' | 'decline' | 'revoke' | 'expire',
): CaseHandoffStatus | null {
  if (event === 'consent_recorded' && current === 'pending_consent') {
    return 'pending_acceptance';
  }
  if (event === 'accept' && current === 'pending_acceptance') {
    return 'accepted';
  }
  if (event === 'decline' && (current === 'pending_consent' || current === 'pending_acceptance')) {
    return 'declined';
  }
  if (event === 'revoke' && (current === 'pending_consent' || current === 'pending_acceptance')) {
    return 'revoked';
  }
  if (event === 'expire' && (current === 'pending_consent' || current === 'pending_acceptance')) {
    return 'expired';
  }
  return null;
}

// ---------------------------------------------------------------------------
// Governance gate
// ---------------------------------------------------------------------------

/**
 * Confirm that both orgs are eligible to participate in a handoff. Throws
 * `HandoffGateDeniedError` on the first failing check.
 */
export async function assertHandoffPermitted(
  fromPartnerOrgId: string,
  toPartnerOrgId: string,
): Promise<void> {
  if (fromPartnerOrgId === toPartnerOrgId) {
    throw new HandoffGateDeniedError(
      'same_org',
      'Handoff from and to the same org is not allowed.',
    );
  }
  const [fromState, toState] = await Promise.all([
    loadOrgGateState(fromPartnerOrgId),
    loadOrgGateState(toPartnerOrgId),
  ]);
  if (!fromState) {
    throw new HandoffGateDeniedError(
      'unknown_from_org',
      `from_partner_org_id ${fromPartnerOrgId} not found.`,
    );
  }
  if (!toState) {
    throw new HandoffGateDeniedError(
      'unknown_to_org',
      `to_partner_org_id ${toPartnerOrgId} not found.`,
    );
  }
  if (!fromState.active) {
    throw new HandoffGateDeniedError('from_org_inactive', 'Initiating partner org is inactive.');
  }
  if (!toState.active) {
    throw new HandoffGateDeniedError('to_org_inactive', 'Receiving partner org is inactive.');
  }
  if (!fromState.hasActiveAgreement) {
    throw new HandoffGateDeniedError(
      'from_org_no_active_agreement',
      'Initiating partner org has no active agreement on file with the coalition.',
    );
  }
  if (!toState.hasActiveAgreement) {
    throw new HandoffGateDeniedError(
      'to_org_no_active_agreement',
      'Receiving partner org has no active agreement on file with the coalition.',
    );
  }
}

// ---------------------------------------------------------------------------
// State-machine operations
// ---------------------------------------------------------------------------

export interface InitiateHandoffInput {
  syntheticPersonRef: string;
  fromPartnerOrgId: string;
  toPartnerOrgId: string;
  initiatedByUserId: string;
  purpose: string;
  requestedScope: readonly string[];
  /** Optional: existing person_partner_consents row that already authorises the receiver. */
  consentId?: string;
  /** Override default 30d TTL — primarily for tests. */
  ttlDays?: number;
  now?: Date;
}

/**
 * Create a new handoff request. Routes through both gates; status starts at
 * `pending_consent` unless a covering consent is supplied.
 */
export async function initiateHandoff(input: InitiateHandoffInput): Promise<CaseHandoff> {
  const requestedScope = validateRequestedScope(input.requestedScope);
  await assertHandoffPermitted(input.fromPartnerOrgId, input.toPartnerOrgId);

  const now = input.now ?? new Date();
  const consentId = input.consentId ?? null;
  let initialStatus: CaseHandoffStatus = 'pending_consent';

  if (consentId) {
    const consent = await getActivePersonPartnerConsent(consentId);
    assertConsentCoversHandoff(consent, input.syntheticPersonRef, input.toPartnerOrgId);
    initialStatus = 'pending_acceptance';
  }

  const insertValue: NewCaseHandoff = {
    syntheticPersonRef: input.syntheticPersonRef,
    fromPartnerOrgId: input.fromPartnerOrgId,
    toPartnerOrgId: input.toPartnerOrgId,
    initiatedByUserId: input.initiatedByUserId,
    purpose: input.purpose,
    requestedScope,
    consentId,
    expiresAt: computeExpiresAt(now, input.ttlDays),
    status: initialStatus,
  };

  return db.transaction(async (tx) => {
    const inserted = await insertCaseHandoff(insertValue, tx);
    await logAuditEvent({
      actorUserId: input.initiatedByUserId,
      action: 'case_handoff.initiated',
      targetTable: 'case_handoffs',
      targetId: inserted.id,
      metadata: {
        from_partner_org_id: input.fromPartnerOrgId,
        to_partner_org_id: input.toPartnerOrgId,
        synthetic_person_ref: input.syntheticPersonRef,
        scope: requestedScope,
        initial_status: initialStatus,
      },
      tx,
    });
    return inserted;
  });
}

/**
 * Link a freshly-granted consent to a handoff sitting in `pending_consent`,
 * advancing it to `pending_acceptance`.
 */
export async function recordHandoffConsent(
  handoffId: string,
  consentId: string,
  actorUserId: string,
): Promise<CaseHandoff> {
  const handoff = await loadHandoffOrThrow(handoffId);
  const next = nextStatus(handoff.status, 'consent_recorded');
  if (!next) {
    throw new HandoffStateMachineError(
      'wrong_state_for_consent',
      `Handoff ${handoffId} is in status '${handoff.status}'; cannot record consent.`,
    );
  }
  const consent = await getActivePersonPartnerConsent(consentId);
  assertConsentCoversHandoff(consent, handoff.syntheticPersonRef, handoff.toPartnerOrgId);

  return db.transaction(async (tx) => {
    const updated = await updateCaseHandoff(handoffId, { consentId, status: next }, tx);
    await logAuditEvent({
      actorUserId,
      action: 'case_handoff.consent_recorded',
      targetTable: 'case_handoffs',
      targetId: handoffId,
      metadata: { consent_id: consentId, prior_status: handoff.status, status: next },
      tx,
    });
    return updated;
  });
}

/**
 * Receiver-side accept. Caller is responsible for verifying the user belongs
 * to `toPartnerOrgId` before invoking.
 */
export async function acceptHandoff(
  handoffId: string,
  acceptingUserId: string,
): Promise<CaseHandoff> {
  const handoff = await loadHandoffOrThrow(handoffId);
  const next = nextStatus(handoff.status, 'accept');
  if (!next) {
    throw new HandoffStateMachineError(
      'wrong_state_for_accept',
      `Handoff ${handoffId} is in status '${handoff.status}'; only 'pending_acceptance' can be accepted.`,
    );
  }

  const now = new Date();
  return db.transaction(async (tx) => {
    const updated = await updateCaseHandoff(
      handoffId,
      { status: next, respondedByUserId: acceptingUserId, acceptedAt: now },
      tx,
    );
    await logAuditEvent({
      actorUserId: acceptingUserId,
      action: 'case_handoff.accepted',
      targetTable: 'case_handoffs',
      targetId: handoffId,
      metadata: { prior_status: handoff.status },
      tx,
    });
    return updated;
  });
}

/** Receiver-side decline. */
export async function declineHandoff(
  handoffId: string,
  decliningUserId: string,
  reason: string,
): Promise<CaseHandoff> {
  const handoff = await loadHandoffOrThrow(handoffId);
  const next = nextStatus(handoff.status, 'decline');
  if (!next) {
    throw new HandoffStateMachineError(
      'wrong_state_for_decline',
      `Handoff ${handoffId} is in status '${handoff.status}'; cannot decline.`,
    );
  }
  const now = new Date();
  return db.transaction(async (tx) => {
    const updated = await updateCaseHandoff(
      handoffId,
      {
        status: next,
        respondedByUserId: decliningUserId,
        declineReason: reason,
        closedAt: now,
      },
      tx,
    );
    await logAuditEvent({
      actorUserId: decliningUserId,
      action: 'case_handoff.declined',
      targetTable: 'case_handoffs',
      targetId: handoffId,
      metadata: { prior_status: handoff.status, reason },
      tx,
    });
    return updated;
  });
}

/** Initiator-side revoke. Subjects can also trigger revocation indirectly. */
export async function revokeHandoff(
  handoffId: string,
  revokingUserId: string,
): Promise<CaseHandoff> {
  const handoff = await loadHandoffOrThrow(handoffId);
  const next = nextStatus(handoff.status, 'revoke');
  if (!next) {
    throw new HandoffStateMachineError(
      'wrong_state_for_revoke',
      `Handoff ${handoffId} is in status '${handoff.status}'; cannot revoke.`,
    );
  }
  const now = new Date();
  return db.transaction(async (tx) => {
    const updated = await updateCaseHandoff(handoffId, { status: next, closedAt: now }, tx);
    await logAuditEvent({
      actorUserId: revokingUserId,
      action: 'case_handoff.revoked',
      targetTable: 'case_handoffs',
      targetId: handoffId,
      metadata: { prior_status: handoff.status },
      tx,
    });
    return updated;
  });
}

/**
 * Sweep transition for a single handoff — marks it `expired` and writes
 * an audit row. Returns the updated row, or null if the row's current
 * status no longer permits expiration (race-safe).
 */
export async function expireHandoff(handoffId: string): Promise<CaseHandoff | null> {
  const handoff = await getCaseHandoff(handoffId);
  if (!handoff) return null;
  const next = nextStatus(handoff.status, 'expire');
  if (!next) return null;
  const now = new Date();
  return db.transaction(async (tx) => {
    const updated = await updateCaseHandoff(handoffId, { status: next, closedAt: now }, tx);
    await logAuditEvent({
      actorUserId: null,
      action: 'case_handoff.expired',
      targetTable: 'case_handoffs',
      targetId: handoffId,
      metadata: { prior_status: handoff.status, expires_at: handoff.expiresAt.toISOString() },
      tx,
    });
    return updated;
  });
}

// ---------------------------------------------------------------------------
// Internal helpers
// ---------------------------------------------------------------------------

async function loadHandoffOrThrow(handoffId: string): Promise<CaseHandoff> {
  const row = await getCaseHandoff(handoffId);
  if (!row) {
    throw new HandoffStateMachineError('not_found', `Handoff ${handoffId} not found.`);
  }
  return row;
}

function assertConsentCoversHandoff(
  consent: { syntheticPersonRef: string; partnerOrgId: string; revokedAt: Date | null } | null,
  syntheticPersonRef: string,
  toPartnerOrgId: string,
): asserts consent is { syntheticPersonRef: string; partnerOrgId: string; revokedAt: null } {
  if (!consent) {
    throw new HandoffStateMachineError(
      'consent_revoked',
      'Consent record not found or already revoked.',
    );
  }
  if (consent.partnerOrgId !== toPartnerOrgId) {
    throw new HandoffStateMachineError(
      'consent_org_mismatch',
      'Consent is for a different partner org than this handoff.',
    );
  }
  if (consent.syntheticPersonRef !== syntheticPersonRef) {
    throw new HandoffStateMachineError(
      'consent_subject_mismatch',
      'Consent subject ref does not match the handoff subject ref.',
    );
  }
}
