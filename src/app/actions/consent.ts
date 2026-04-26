'use server';

import { eq } from 'drizzle-orm';
import { revalidatePath } from 'next/cache';
import { db } from '@/db/client';
import { personPartnerConsents } from '@/db/schema/person-partner-consents';
import { logAuditEvent } from '@/lib/audit';
import { isValidSyntheticPersonRef } from '@/lib/synthetic-person';

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

export async function regrantConsentAction(
  syntheticPersonRef: string,
  consentId: string,
): Promise<ConsentResult> {
  if (!isValidSyntheticPersonRef(syntheticPersonRef))
    return { ok: false, error: 'Invalid identifier.' };

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
