/**
 * SUBP-004 — abuser-blind authorization middleware (ADR 0007).
 *
 * The single chokepoint for "may this viewer read this survivor record?"
 * Every code path that reads from `dv_survivors` MUST route through
 * `requireSurvivorReader` (or call `isAuthorizedReader` for soft-handling).
 * Direct queries against the table are forbidden by the boundary lint —
 * see `scripts/check-domain-boundaries.mts`.
 *
 * The threat model: an abuser tries to obtain the survivor's current
 * location through any data path the coalition exposes. Misuse vectors:
 *   - A non-assigned caseworker browses a list and sees address fields
 *   - An attorney's case-search lookup correlates a defendant with an
 *     OASIS-flagged survivor and surfaces the OASIS record
 *   - An auth-failure error message echoes the survivor id, turning the
 *     gate into an enumeration oracle
 *
 * This module addresses 1 and 2 (role + assignment check) and 3 (no
 * enumeration in error messages). Field-level redaction (the OASIS DSA's
 * redaction_policy) is layered on top in the per-field reader helpers in
 * `dv-survivors.ts`.
 *
 * Pure functions — no DB calls, no clocks. Tested in isolation.
 */

import type { UserRole } from '@/db/schema/enums';

export type AdvocateAuthInput = {
  id: string;
  role: UserRole;
};

/** Minimal slice of `DvSurvivor` needed for the access decision. */
export type SurvivorRow = {
  id: string;
  assignedAdvocateUserId: string | null;
};

export type AbuserBlindDenyReason =
  | 'viewer_id_missing'
  | 'role_not_authorized'
  | 'survivor_unassigned'
  | 'not_assigned_advocate';

export type AbuserBlindDecision =
  | { allowed: true }
  | { allowed: false; reason: AbuserBlindDenyReason };

export class AbuserBlindDeniedError extends Error {
  reason: AbuserBlindDenyReason;
  constructor(reason: AbuserBlindDenyReason, message: string) {
    super(message);
    this.name = 'AbuserBlindDeniedError';
    this.reason = reason;
  }
}

/**
 * Decide whether `viewer` may read `survivor`. Pure; no DB.
 *
 * Allow rules (only one needs to match):
 *   - Viewer is admin (any survivor, any assignment state)
 *   - Viewer is a caseworker AND viewer.id === survivor.assignedAdvocateUserId
 *
 * Everything else denies. Attorneys are denied today; future ROI-based
 * access for attorneys is a separate story.
 */
export function isAuthorizedReader(
  viewer: AdvocateAuthInput,
  survivor: SurvivorRow,
): AbuserBlindDecision {
  if (!viewer.id) {
    return { allowed: false, reason: 'viewer_id_missing' };
  }

  if (viewer.role === 'admin') {
    return { allowed: true };
  }

  if (viewer.role !== 'caseworker') {
    return { allowed: false, reason: 'role_not_authorized' };
  }

  // viewer.role === 'caseworker'
  if (survivor.assignedAdvocateUserId === null) {
    return { allowed: false, reason: 'survivor_unassigned' };
  }

  if (survivor.assignedAdvocateUserId !== viewer.id) {
    return { allowed: false, reason: 'not_assigned_advocate' };
  }

  return { allowed: true };
}

/**
 * Throw-on-deny wrapper. Use this at the boundary of every read path.
 *
 * Error messages are intentionally generic — they MUST NOT reveal the
 * survivor id, the viewer id, or any structural detail an abuser could
 * use to enumerate. ADR 0007 § Decision rule 5.
 */
export function requireSurvivorReader(viewer: AdvocateAuthInput, survivor: SurvivorRow): void {
  const decision = isAuthorizedReader(viewer, survivor);
  if (decision.allowed) return;

  const messages: Record<AbuserBlindDenyReason, string> = {
    viewer_id_missing: 'Authorization denied: viewer is not authenticated.',
    role_not_authorized:
      'Authorization denied: this role does not have access to DV-survivor records.',
    survivor_unassigned:
      'Authorization denied: this survivor record is unassigned. Admin assignment required.',
    not_assigned_advocate:
      'Authorization denied: this survivor record is assigned to a different advocate.',
  };

  throw new AbuserBlindDeniedError(decision.reason, messages[decision.reason]);
}
