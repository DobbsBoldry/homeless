import type { Consent } from '@/db/schema/consents';
import { CURRENT_CONSENT_VERSION } from './consent-text';

export type ConsentState = 'granted' | 'revoked' | 'expired';

/**
 * Compute the live state of a consent record. Stored fields are the
 * source of truth (granted_at, revoked_at, expires_at); the state is
 * derived at read time so wall-clock changes (TTL passing) flip the
 * label without a write.
 *
 * Order matters: revoked beats expired beats granted. A subject who
 * revokes mid-window stays revoked even after the original window
 * passes.
 */
export function consentState(c: Consent, now: Date = new Date()): ConsentState {
  if (c.revokedAt) return 'revoked';
  if (c.expiresAt && new Date(c.expiresAt).getTime() <= now.getTime()) return 'expired';
  return 'granted';
}

export type ConsentScope = {
  partnerOrgIds: string[] | null;
  dataClasses: string[] | null;
};

/**
 * True iff a consent in `granted` state covers the (partner_org, data_class)
 * being requested. `null` scopes mean "any" — that's the default for
 * coalition-wide consents that don't single out specific partners or data.
 *
 * Callers asking "can partner X see data class Y about subject Z?" should:
 *   1. fetch consents WHERE subject_external_id = Z and consent_type = …
 *   2. filter to consentState === 'granted'
 *   3. check at least one row covers (X, Y) via this helper.
 */
export function consentCovers(
  scope: ConsentScope,
  partnerOrgId: string,
  dataClass: string,
): boolean {
  const partnerOk = scope.partnerOrgIds === null || scope.partnerOrgIds.includes(partnerOrgId);
  const classOk = scope.dataClasses === null || scope.dataClasses.includes(dataClass);
  return partnerOk && classOk;
}

/**
 * True if the consent text the subject saw is older than the current
 * version. Doesn't invalidate the consent — surfaced in the dashboard
 * as a re-prompt candidate.
 */
export function consentNeedsRefresh(c: Consent): boolean {
  return c.consentVersion !== CURRENT_CONSENT_VERSION;
}
