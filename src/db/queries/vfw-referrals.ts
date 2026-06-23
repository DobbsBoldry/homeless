/**
 * SUBP-006c — VFW referral query layer. Creating a referral persists a JSONB
 * packet snapshot and audit-logs the event in the same transaction.
 */
import { desc, eq } from 'drizzle-orm';
import { db } from '@/db/client';
import { type NewVfwReferral, type VfwReferral, vfwReferrals } from '@/db/schema/vfw-referrals';
import { logAuditEvent } from '@/lib/audit';
import type { VfwReferralPacket } from '@/lib/subp';

export interface CreateVfwReferralInput {
  veteranId: string;
  triggeredByUserId: string;
  packet: VfwReferralPacket;
}

export async function createVfwReferral(input: CreateVfwReferralInput): Promise<VfwReferral> {
  return db.transaction(async (tx) => {
    const values: NewVfwReferral = {
      veteranId: input.veteranId,
      triggeredByUserId: input.triggeredByUserId,
      recipient: input.packet.recipient,
      packet: input.packet,
    };
    const [row] = await tx.insert(vfwReferrals).values(values).returning();
    await logAuditEvent({
      actorUserId: input.triggeredByUserId,
      action: 'vfw_referral.triggered',
      targetTable: 'vfw_referrals',
      targetId: row.id,
      metadata: {
        veteranId: input.veteranId,
        recipient: input.packet.recipient,
        voucherCount: input.packet.matchedVouchers.length,
      },
      tx,
    });
    return row;
  });
}

export async function listVfwReferralsForVeteran(veteranId: string): Promise<VfwReferral[]> {
  return db
    .select()
    .from(vfwReferrals)
    .where(eq(vfwReferrals.veteranId, veteranId))
    .orderBy(desc(vfwReferrals.createdAt));
}

export async function getLatestVfwReferral(veteranId: string): Promise<VfwReferral | null> {
  const [row] = await db
    .select()
    .from(vfwReferrals)
    .where(eq(vfwReferrals.veteranId, veteranId))
    .orderBy(desc(vfwReferrals.createdAt))
    .limit(1);
  return row ?? null;
}
