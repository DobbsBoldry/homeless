'use server';

import { revalidatePath } from 'next/cache';
import {
  listApplicationsForVeteran,
  listVouchers,
  setApplicationStatus,
} from '@/db/queries/hud-vash-vouchers';
import { getVeteran } from '@/db/queries/veterans';
import { createVfwReferral } from '@/db/queries/vfw-referrals';
import type { VeteranVoucherApplicationStatus } from '@/db/schema/hud-vash-vouchers';
import { requireRole } from '@/lib/auth';
import {
  buildVfwReferralPacket,
  describeVeteranEligibility,
  isVeteranEligible,
  type ReferralMatchInput,
  scoreVoucherMatch,
  type VeteranVoucherStage,
} from '@/lib/subp';

export type TriggerReferralResult = { ok: true; referralId: string } | { ok: false; error: string };

export type SimpleResult = { ok: true } | { ok: false; error: string };

const VALID_STATUSES: readonly VeteranVoucherApplicationStatus[] = [
  'applied',
  'pending',
  'approved',
  'housed',
  'withdrawn',
];

function stageOf(status: string | undefined): VeteranVoucherStage {
  switch (status) {
    case 'applied':
    case 'pending':
    case 'approved':
    case 'housed':
      return status;
    default:
      return 'not_applied';
  }
}

/**
 * SUBP-006c — caseworker triggers a VFW Owensboro referral from a veteran's
 * detail view. Builds a packet snapshot from the live match data, persists the
 * referral (audit-logged inside the query), and returns its id.
 */
export async function triggerVfwReferralAction(veteranId: string): Promise<TriggerReferralResult> {
  const actor = await requireRole(['caseworker', 'admin']);

  const veteran = await getVeteran(veteranId);
  if (!veteran) return { ok: false, error: 'Veteran not found.' };
  if (!isVeteranEligible(veteran)) {
    return { ok: false, error: 'Veteran eligibility must be confirmed before referral.' };
  }

  const [vouchers, applications] = await Promise.all([
    listVouchers({ availableOnly: true }),
    listApplicationsForVeteran(veteranId),
  ]);
  const statusByVoucher = new Map(applications.map((a) => [a.voucherId, a.status]));

  const matches: ReferralMatchInput[] = vouchers.map((v) => {
    const match = scoreVoucherMatch(
      {
        bedroomNeed: veteran.bedroomNeed,
        accessibilityNeed: veteran.accessibilityNeed,
        targetZip: veteran.targetZip,
      },
      { bedrooms: v.bedrooms, accessible: v.accessible, zip: v.zip },
    );
    const status = statusByVoucher.get(v.id);
    return {
      voucherCode: v.voucherCode,
      unitType: v.unitType,
      bedrooms: v.bedrooms,
      location: v.location,
      zip: v.zip,
      score: match.score,
      applied: status === 'applied' || status === 'pending' || status === 'approved',
      stage: stageOf(status),
    };
  });

  const caseworkerName =
    [actor.firstName, actor.lastName].filter(Boolean).join(' ').trim() || actor.email || null;

  const packet = buildVfwReferralPacket({
    veteran,
    caseworkerName,
    matches,
    eligibilitySummary: describeVeteranEligibility(veteran),
  });

  const referral = await createVfwReferral({
    veteranId,
    triggeredByUserId: actor.id,
    packet,
  });

  revalidatePath(`/app/clients/veterans/${veteranId}`);
  return { ok: true, referralId: referral.id };
}

/** Advance a voucher application's status along the pipeline. */
export async function advanceApplicationStatusAction(
  applicationId: string,
  status: string,
): Promise<SimpleResult> {
  const actor = await requireRole(['caseworker', 'admin']);
  if (!applicationId) return { ok: false, error: 'Missing application id.' };
  if (!VALID_STATUSES.includes(status as VeteranVoucherApplicationStatus)) {
    return { ok: false, error: 'Invalid status.' };
  }
  const row = await setApplicationStatus(
    applicationId,
    status as VeteranVoucherApplicationStatus,
    actor.id,
  );
  if (!row) return { ok: false, error: 'Application not found.' };
  revalidatePath(`/app/clients/veterans/${row.veteranId}`);
  return { ok: true };
}
