'use server';

import { eq } from 'drizzle-orm';
import { revalidatePath } from 'next/cache';
import { db } from '@/db/client';
import { consents } from '@/db/schema/consents';
import { type ConsentChannel, type ConsentType, consentChannelEnum } from '@/db/schema/enums';
import { personPartnerConsents } from '@/db/schema/person-partner-consents';
import { logAuditEvent } from '@/lib/audit';
import { CURRENT_CONSENT_VERSION, DATA_CLASSES } from '@/lib/dtrs/consent-text';
import { rateLimit } from '@/lib/dtrs/rate-limit';
import { isValidSyntheticPersonRef } from '@/lib/synthetic-person';

const CONSENT_RATE_WINDOW_MS = 60_000;
const CONSENT_RATE_LIMIT = 6; // 6 ops/min per subject is plenty for legit use.

export type ConsentResult = { ok: true } | { ok: false; error: string };

/**
 * Phase-1 stub: anyone with the URL can revoke or re-grant. Real flow
 * needs a one-time-link / QR auth gate (caseworker-distributed). Logged
 * in audit_log without an actor since there is no signed-in user here.
 */
export async function revokeConsentAction(
  syntheticPersonRef: string,
  consentId: string,
): Promise<ConsentResult> {
  if (!isValidSyntheticPersonRef(syntheticPersonRef))
    return { ok: false, error: 'Invalid identifier.' };

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
  scopeDataClasses?: string[] | null;
  scopePartnerIds?: string[] | null;
  expiresAt?: Date | null;
};

export type GrantConsentResult = { ok: true; id: string } | { ok: false; error: string };

/**
 * Public-surface server action: record a fresh, versioned consent grant
 * (DTRS-001 schema, DTRS-002 form). The subject themselves writes here
 * — no role gate, but inputs are validated and capped, and every grant
 * lands in audit_log so spurious grants are traceable. The opaque
 * subject_external_id is the auth boundary: only the caseworker who
 * shared the link knows the value.
 *
 * Once a one-time-link auth gate ships (#251), this action gets the
 * token check too.
 */
export async function grantConsentAction(input: GrantConsentInput): Promise<GrantConsentResult> {
  const subject = input.subjectExternalId.trim();
  if (subject.length === 0) return { ok: false, error: 'Missing subject identifier.' };

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
): Promise<ConsentResult> {
  if (!isValidSyntheticPersonRef(syntheticPersonRef))
    return { ok: false, error: 'Invalid identifier.' };

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
