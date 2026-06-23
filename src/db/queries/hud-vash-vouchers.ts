/**
 * SUBP-006b — HUD-VASH voucher + application query layer.
 *
 * Vouchers are admin-managed seed data (manual CRUD). Applications track a
 * (veteran, voucher) pair. All mutations are audit-logged in the same
 * transaction as the write.
 */
import { and, asc, eq } from 'drizzle-orm';
import { db } from '@/db/client';
import {
  type HudVashVoucher,
  hudVashVouchers,
  type NewHudVashVoucher,
  type VeteranVoucherApplication,
  type VeteranVoucherApplicationStatus,
  veteranVoucherApplications,
} from '@/db/schema/hud-vash-vouchers';
import { logAuditEvent } from '@/lib/audit';

// ---------------------------------------------------------------------------
// Vouchers (admin-managed)
// ---------------------------------------------------------------------------

export async function listVouchers(
  opts: { availableOnly?: boolean } = {},
): Promise<HudVashVoucher[]> {
  const rows = await db
    .select()
    .from(hudVashVouchers)
    .orderBy(asc(hudVashVouchers.location), asc(hudVashVouchers.voucherCode));
  return opts.availableOnly ? rows.filter((v) => v.availabilityStatus === 'available') : rows;
}

export async function getVoucher(id: string): Promise<HudVashVoucher | null> {
  const [row] = await db.select().from(hudVashVouchers).where(eq(hudVashVouchers.id, id)).limit(1);
  return row ?? null;
}

export async function createVoucher(
  input: NewHudVashVoucher,
  actorUserId: string,
): Promise<HudVashVoucher> {
  return db.transaction(async (tx) => {
    const [row] = await tx.insert(hudVashVouchers).values(input).returning();
    await logAuditEvent({
      actorUserId,
      action: 'hud_vash_voucher.created',
      targetTable: 'hud_vash_vouchers',
      targetId: row.id,
      metadata: { voucherCode: row.voucherCode, bedrooms: row.bedrooms },
      tx,
    });
    return row;
  });
}

export async function updateVoucher(
  id: string,
  patch: Partial<NewHudVashVoucher>,
  actorUserId: string,
): Promise<HudVashVoucher | null> {
  return db.transaction(async (tx) => {
    const [row] = await tx
      .update(hudVashVouchers)
      .set({ ...patch, updatedAt: new Date() })
      .where(eq(hudVashVouchers.id, id))
      .returning();
    if (!row) return null;
    await logAuditEvent({
      actorUserId,
      action: 'hud_vash_voucher.updated',
      targetTable: 'hud_vash_vouchers',
      targetId: id,
      metadata: { fields: Object.keys(patch) },
      tx,
    });
    return row;
  });
}

export async function deleteVoucher(id: string, actorUserId: string): Promise<boolean> {
  return db.transaction(async (tx) => {
    const [row] = await tx
      .delete(hudVashVouchers)
      .where(eq(hudVashVouchers.id, id))
      .returning({ id: hudVashVouchers.id });
    if (!row) return false;
    await logAuditEvent({
      actorUserId,
      action: 'hud_vash_voucher.deleted',
      targetTable: 'hud_vash_vouchers',
      targetId: id,
      tx,
    });
    return true;
  });
}

// ---------------------------------------------------------------------------
// Applications (per veteran)
// ---------------------------------------------------------------------------

export async function listApplicationsForVeteran(
  veteranId: string,
): Promise<VeteranVoucherApplication[]> {
  return db
    .select()
    .from(veteranVoucherApplications)
    .where(eq(veteranVoucherApplications.veteranId, veteranId));
}

/**
 * Record (or re-activate) a veteran's application to a voucher. Idempotent on
 * the (veteran, voucher) pair: a withdrawn row flips back to 'applied'.
 */
export async function applyToVoucher(
  veteranId: string,
  voucherId: string,
  actorUserId: string,
): Promise<VeteranVoucherApplication> {
  return db.transaction(async (tx) => {
    const [existing] = await tx
      .select()
      .from(veteranVoucherApplications)
      .where(
        and(
          eq(veteranVoucherApplications.veteranId, veteranId),
          eq(veteranVoucherApplications.voucherId, voucherId),
        ),
      )
      .limit(1);

    let row: VeteranVoucherApplication;
    if (existing) {
      [row] = await tx
        .update(veteranVoucherApplications)
        .set({ status: 'applied', appliedByUserId: actorUserId, updatedAt: new Date() })
        .where(eq(veteranVoucherApplications.id, existing.id))
        .returning();
    } else {
      [row] = await tx
        .insert(veteranVoucherApplications)
        .values({ veteranId, voucherId, status: 'applied', appliedByUserId: actorUserId })
        .returning();
    }

    await logAuditEvent({
      actorUserId,
      action: 'veteran_voucher.applied',
      targetTable: 'veteran_voucher_applications',
      targetId: row.id,
      metadata: { veteranId, voucherId },
      tx,
    });
    return row;
  });
}

/**
 * SUBP-006c — set a (veteran, voucher) application's status along the
 * pipeline (applied → pending → approved → housed, or withdrawn). Audit-logged
 * in the same transaction. Returns the updated row, or null if not found.
 */
export async function setApplicationStatus(
  applicationId: string,
  status: VeteranVoucherApplicationStatus,
  actorUserId: string,
): Promise<VeteranVoucherApplication | null> {
  return db.transaction(async (tx) => {
    const [row] = await tx
      .update(veteranVoucherApplications)
      .set({ status, updatedAt: new Date() })
      .where(eq(veteranVoucherApplications.id, applicationId))
      .returning();
    if (!row) return null;
    await logAuditEvent({
      actorUserId,
      action: 'veteran_voucher.status_changed',
      targetTable: 'veteran_voucher_applications',
      targetId: row.id,
      metadata: { veteranId: row.veteranId, voucherId: row.voucherId, status },
      tx,
    });
    return row;
  });
}

/** All voucher applications across subjects — used to derive list-view stages. */
export async function listAllVoucherApplications(): Promise<VeteranVoucherApplication[]> {
  return db.select().from(veteranVoucherApplications);
}
