'use server';

import * as Sentry from '@sentry/nextjs';
import { and, eq } from 'drizzle-orm';
import { revalidatePath } from 'next/cache';
import { db } from '@/db/client';
import { createSchoolReferral } from '@/db/queries/school-referrals';
import { orgMemberships } from '@/db/schema/org-memberships';
import { partnerOrgs } from '@/db/schema/partner-orgs';
import { requireUser } from '@/lib/auth';
import { parseSchoolReferralForm } from './school-referrals-parse';

export type { ParsedSchoolReferralInput } from './school-referrals-parse';

export type SubmitSchoolReferralResult =
  | { ok: true; referralId: string }
  | { ok: false; error: string };

const KNOWN_DOMAIN_PREFIXES = [
  'mckinney-vento',
  'mvauthorizationconfirmed',
  "basis 'parental_consent'",
  "basis 'eligible_student_consent'",
  'school partner org',
  'not a member',
] as const;

/**
 * Server action: submit a school referral from a McKinney-Vento liaison.
 *
 * Auth: any authenticated user who is an active member of a school-type
 * partner org. The liaison's partnerOrgId is taken from the form (they may
 * belong to multiple school orgs, though in practice it's usually one).
 * Membership is validated server-side — the form value is untrusted.
 */
export async function submitSchoolReferralAction(
  formData: FormData,
): Promise<SubmitSchoolReferralResult> {
  const user = await requireUser();

  const parsed = parseSchoolReferralForm(formData);
  if (!parsed.ok) return { ok: false, error: parsed.error };

  // Verify user is a member of the claimed school partner org.
  const [membership] = await db
    .select({ id: orgMemberships.id })
    .from(orgMemberships)
    .innerJoin(partnerOrgs, eq(orgMemberships.partnerOrgId, partnerOrgs.id))
    .where(
      and(
        eq(orgMemberships.userId, user.id),
        eq(orgMemberships.partnerOrgId, parsed.input.partnerOrgId),
        eq(partnerOrgs.type, 'school'),
      ),
    )
    .limit(1);

  if (!membership) {
    return {
      ok: false,
      error: 'You are not a member of the selected school partner org or it is not a school.',
    };
  }

  try {
    const referral = await createSchoolReferral({
      partnerOrgId: parsed.input.partnerOrgId,
      referringUserId: user.id,
      studentFirstInitial: parsed.input.studentFirstInitial,
      studentAge: parsed.input.studentAge,
      studentGradeBand: parsed.input.studentGradeBand,
      guardianName: parsed.input.guardianName,
      guardianContact: parsed.input.guardianContact,
      housingSituation: parsed.input.housingSituation,
      servicesRequested: parsed.input.servicesRequested,
      urgency: parsed.input.urgency,
      notes: parsed.input.notes,
      basis: parsed.input.basis,
      mvAuthorizationConfirmed: parsed.input.mvAuthorizationConfirmed,
      consentSignedAt: parsed.input.consentSignedAt,
      consentSignedMethod: parsed.input.consentSignedMethod,
      consentConsenterName: parsed.input.consentConsenterName,
      consentConsenterRelationship: parsed.input.consentConsenterRelationship,
    });

    revalidatePath('/app/partner/school-referral/intake');
    return { ok: true, referralId: referral.id };
  } catch (err) {
    Sentry.captureException(err);
    console.error('[school-referrals.submit] failed', err);
    const raw = err instanceof Error ? err.message : '';
    const isKnown = KNOWN_DOMAIN_PREFIXES.some((prefix) =>
      raw.toLowerCase().startsWith(prefix.toLowerCase()),
    );
    const error = isKnown ? raw : 'Submission failed — please retry. The error has been logged.';
    return { ok: false, error };
  }
}
