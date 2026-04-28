'use server';

import { logAuditEvent } from '@/lib/audit';
import { requireRole } from '@/lib/auth';
import { CONSENT_TOKEN_TTL_MS, createConsentAccessToken } from '@/lib/dtrs';
import { isValidSyntheticPersonRef } from '@/lib/synthetic-person';

export type MintTokenResult =
  | { ok: true; url: string; expiresAt: Date }
  | { ok: false; error: string };

const STAFF_ROLES = ['caseworker', 'shelter_staff', 'admin'] as const;

/**
 * Mint a fresh access token for a synthetic person ref. Returns the
 * full URL to hand to the subject (with origin). Only the originating
 * caseworker (or any staff in `STAFF_ROLES`) can mint; subjects
 * cannot mint for themselves.
 */
export async function mintConsentTokenAction(
  syntheticPersonRef: string,
  notes?: string,
): Promise<MintTokenResult> {
  const me = await requireRole(STAFF_ROLES);

  if (!isValidSyntheticPersonRef(syntheticPersonRef)) {
    return { ok: false, error: 'Invalid synthetic-person reference.' };
  }

  const { token, expiresAt } = await createConsentAccessToken({
    syntheticPersonRef,
    issuedByUserId: me.id,
    notes: notes?.trim() || undefined,
    ttlMs: CONSENT_TOKEN_TTL_MS,
  });

  await logAuditEvent({
    actorUserId: me.id,
    action: 'consent_token.minted',
    targetTable: 'consent_access_tokens',
    metadata: { syntheticPersonRef, ttlHours: CONSENT_TOKEN_TTL_MS / 3_600_000 },
  });

  // Path-only URL — caller can prepend origin if needed; staff usually
  // copy/paste into a chat or QR generator.
  const url = `/p/${syntheticPersonRef}/consent/grant?token=${token}`;
  return { ok: true, url, expiresAt };
}
