'use server';

import { eq } from 'drizzle-orm';
import { revalidatePath } from 'next/cache';
import { db } from '@/db/client';
import { consents } from '@/db/schema/consents';
import { type ConsentChannel, type ConsentType, consentChannelEnum } from '@/db/schema/enums';
import { personPartnerConsents } from '@/db/schema/person-partner-consents';
import { logAuditEvent } from '@/lib/audit';
import {
  CURRENT_CONSENT_VERSION,
  DATA_CLASSES,
  rateLimit,
  redeemConsentAccessToken,
} from '@/lib/dtrs';
import { isValidSyntheticPersonRef } from '@/lib/synthetic-person';

const CONSENT_RATE_WINDOW_MS = 60_000;
const CONSENT_RATE_LIMIT = 6; // 6 ops/min per subject is plenty for legit use.

export type ConsentResult = { ok: true } | { ok: false; error: string };

/**
 * Verify the public consent surface is allowed to mutate. Either:
 *   - a valid access token bound to the same synthetic_person_ref, OR
 *   - INDC_CONSENT_OPEN_MODE=1 (dev/demo escape hatch)
 *
 * Returns null on success, or an error string. Mirrors the gate on
 * grantConsentAction so the GRANT and EXISTING-CONSENT flows have
 * identical security properties.
 */
async function checkPublicConsentAuth(
  syntheticPersonRef: string,
  accessToken?: string | null,
): Promise<string | null> {
  if (process.env.INDC_CONSENT_OPEN_MODE === '1') return null;
  if (!accessToken) return 'Missing access link. Ask staff for a fresh link.';
  const redeemed = await redeemConsentAccessToken(accessToken);
  if (!redeemed || redeemed.syntheticPersonRef !== syntheticPersonRef) {
    return 'This link is no longer valid. Ask staff for a fresh one.';
  }
  return null;
}

/**
 * Public-surface server action: revoke an existing person/partner
 * consent. Auth: the same access-token gate as grantConsentAction.
 * Logged in audit_log without an actor since there is no signed-in
 * user on this surface.
 */
export async function revokeConsentAction(
  syntheticPersonRef: string,
  consentId: string,
  accessToken?: string | null,
): Promise<ConsentResult> {
  if (!isValidSyntheticPersonRef(syntheticPersonRef))
    return { ok: false, error: 'Invalid identifier.' };

  const authError = await checkPublicConsentAuth(syntheticPersonRef, accessToken);
  if (authError) return { ok: false, error: authError };

  const limit = rateLimit(
    `revoke:${syntheticPersonRef}`,
    CONSENT_RATE_LIMIT,
    CONSENT_RATE_WINDOW_MS,
  );
  if (!limit.ok) {
    return { ok: false, error: 'Too many attempts. Please wait a minute and try again.' };
  }

  const [updated] = await db
    .update(personPartnerConsents)
    .set({ revokedAt: new Date(), updatedAt: new Date() })
    .where(eq(personPartnerConsents.id, consentId))
    .returning({ id: personPartnerConsents.id, partnerOrgId: personPartnerConsents.partnerOrgId });
  if (!updated) return { ok: false, error: 'Consent not found.' };

  await logAuditEvent({
    actorUserId: null,
    action: 'person_partner_consent.revoked',
    targetTable: 'person_partner_consents',
    targetId: updated.id,
    metadata: {
      syntheticPersonRef,
      partnerOrgId: updated.partnerOrgId,
      via: 'public_consent_panel',
    },
  });

  revalidatePath(`/p/${syntheticPersonRef}/consent`);
  return { ok: true };
}

const VALID_DATA_CLASSES: Set<string> = new Set(DATA_CLASSES.map((d) => d.id as string));
const VALID_CHANNELS = new Set<ConsentChannel>(consentChannelEnum.enumValues);
const SIGNATURE_MIN = 1;
const SIGNATURE_MAX = 80;

export type GrantConsentInput = {
  subjectExternalId: string;
  consentType: ConsentType;
  grantedVia: ConsentChannel;
  signatureText: string;
  /**
   * Opaque access token from the URL. Required in non-open-mode prod.
   * The action calls `redeemConsentAccessToken` and rejects unless the
   * token is valid AND maps to the same `subjectExternalId`. The page
   * gate is defense-in-depth — server actions are reachable from any
   * client capable of crafting a POST, so the action is the auth
   * boundary, not the page.
   */
  accessToken?: string | null;
  scopeDataClasses?: string[] | null;
  scopePartnerIds?: string[] | null;
  expiresAt?: Date | null;
};

export type GrantConsentResult = { ok: true; id: string } | { ok: false; error: string };

/**
 * Public-surface server action: record a fresh, versioned consent grant
 * (DTRS-001 schema, DTRS-002 form). Auth: a valid access token from
 * `consent_access_tokens` whose `synthetic_person_ref` matches
 * `subjectExternalId`. The token is required in normal operation;
 * `INDC_CONSENT_OPEN_MODE=1` (dev/demo only) skips the check. The page
 * render gate at `/p/[ref]/consent/grant` is defense-in-depth — the
 * action itself is the security boundary because server actions are
 * reachable from any client.
 */
export async function grantConsentAction(input: GrantConsentInput): Promise<GrantConsentResult> {
  const subject = input.subjectExternalId.trim();
  if (subject.length === 0) return { ok: false, error: 'Missing subject identifier.' };

  // Auth: a valid access token bound to this subject. Open-mode is the
  // only way past — explicit env flag, off in prod by definition.
  const openMode = process.env.INDC_CONSENT_OPEN_MODE === '1';
  if (!openMode) {
    if (!input.accessToken) {
      return { ok: false, error: 'Missing access link. Ask staff for a fresh link.' };
    }
    const redeemed = await redeemConsentAccessToken(input.accessToken);
    if (!redeemed || redeemed.syntheticPersonRef !== subject) {
      return { ok: false, error: 'This link is no longer valid. Ask staff for a fresh one.' };
    }
  }

  const limit = rateLimit(`grant:${subject}`, CONSENT_RATE_LIMIT, CONSENT_RATE_WINDOW_MS);
  if (!limit.ok) {
    return { ok: false, error: 'Too many attempts. Please wait a minute and try again.' };
  }

  if (!VALID_CHANNELS.has(input.grantedVia)) {
    return { ok: false, error: 'Invalid consent channel.' };
  }

  const sig = input.signatureText.trim();
  if (sig.length < SIGNATURE_MIN || sig.length > SIGNATURE_MAX) {
    return { ok: false, error: 'Please type your name to sign.' };
  }

  const dataClasses =
    input.scopeDataClasses === null
      ? null
      : (input.scopeDataClasses ?? []).filter((c) => VALID_DATA_CLASSES.has(c));
  if (dataClasses && dataClasses.length === 0) {
    return { ok: false, error: 'Pick at least one kind of info to share.' };
  }

  const [created] = await db
    .insert(consents)
    .values({
      subjectExternalId: subject,
      consentType: input.consentType,
      grantedVia: input.grantedVia,
      consentVersion: CURRENT_CONSENT_VERSION,
      signatureText: sig,
      scopeDataClasses: dataClasses,
      scopePartnerIds: input.scopePartnerIds ?? null,
      expiresAt: input.expiresAt ?? null,
    })
    .returning({ id: consents.id });

  await logAuditEvent({
    actorUserId: null,
    action: 'consent.granted',
    targetTable: 'consents',
    targetId: created.id,
    metadata: {
      consentType: input.consentType,
      grantedVia: input.grantedVia,
      consentVersion: CURRENT_CONSENT_VERSION,
      hasDataClassScope: dataClasses !== null,
      hasPartnerScope: input.scopePartnerIds != null,
      hasExpiry: Boolean(input.expiresAt),
    },
  });

  return { ok: true, id: created.id };
}

export type RevokeVersionedConsentResult = { ok: true } | { ok: false; error: string };

/** Revoke a versioned `consents` row. Idempotent on already-revoked rows. */
export async function revokeVersionedConsentAction(
  consentId: string,
): Promise<RevokeVersionedConsentResult> {
  const [existing] = await db
    .select({ id: consents.id, subject: consents.subjectExternalId, revokedAt: consents.revokedAt })
    .from(consents)
    .where(eq(consents.id, consentId))
    .limit(1);
  if (!existing) return { ok: false, error: 'Consent not found.' };
  if (existing.revokedAt) return { ok: true };

  await db.update(consents).set({ revokedAt: new Date() }).where(eq(consents.id, consentId));

  await logAuditEvent({
    actorUserId: null,
    action: 'consent.revoked',
    targetTable: 'consents',
    targetId: consentId,
    metadata: { subject: existing.subject },
  });

  return { ok: true };
}

export async function regrantConsentAction(
  syntheticPersonRef: string,
  consentId: string,
  accessToken?: string | null,
): Promise<ConsentResult> {
  if (!isValidSyntheticPersonRef(syntheticPersonRef))
    return { ok: false, error: 'Invalid identifier.' };

  const authError = await checkPublicConsentAuth(syntheticPersonRef, accessToken);
  if (authError) return { ok: false, error: authError };

  const limit = rateLimit(
    `regrant:${syntheticPersonRef}`,
    CONSENT_RATE_LIMIT,
    CONSENT_RATE_WINDOW_MS,
  );
  if (!limit.ok) {
    return { ok: false, error: 'Too many attempts. Please wait a minute and try again.' };
  }

  const [updated] = await db
    .update(personPartnerConsents)
    .set({ revokedAt: null, grantedAt: new Date(), updatedAt: new Date() })
    .where(eq(personPartnerConsents.id, consentId))
    .returning({ id: personPartnerConsents.id, partnerOrgId: personPartnerConsents.partnerOrgId });
  if (!updated) return { ok: false, error: 'Consent not found.' };

  await logAuditEvent({
    actorUserId: null,
    action: 'person_partner_consent.regranted',
    targetTable: 'person_partner_consents',
    targetId: updated.id,
    metadata: {
      syntheticPersonRef,
      partnerOrgId: updated.partnerOrgId,
      via: 'public_consent_panel',
    },
  });

  revalidatePath(`/p/${syntheticPersonRef}/consent`);
  return { ok: true };
}
