'use server';

import { revalidatePath } from 'next/cache';
import {
  applyToVoucher,
  createVoucher,
  deleteVoucher,
  updateVoucher,
} from '@/db/queries/hud-vash-vouchers';
import type { HudVashVoucherStatus } from '@/db/schema/hud-vash-vouchers';
import { requireRole } from '@/lib/auth';

export type VoucherActionResult = { ok: true } | { ok: false; error: string };

const VALID_STATUS: readonly HudVashVoucherStatus[] = ['available', 'pending', 'leased'];

/** SUBP-006b — caseworker records a veteran's application to a voucher. */
export async function applyToVoucherAction(
  veteranId: string,
  voucherId: string,
): Promise<VoucherActionResult> {
  const actor = await requireRole(['caseworker', 'admin']);
  if (!veteranId || !voucherId) return { ok: false, error: 'Missing veteran or voucher.' };
  await applyToVoucher(veteranId, voucherId, actor.id);
  revalidatePath(`/app/clients/veterans/${veteranId}`);
  return { ok: true };
}

interface ParsedVoucher {
  voucherCode: string;
  unitType: string;
  bedrooms: number;
  location: string;
  zip: string | null;
  accessible: boolean;
  availabilityStatus: HudVashVoucherStatus;
  notes: string | null;
}

function parseVoucherForm(
  fd: FormData,
): { ok: true; value: ParsedVoucher } | { ok: false; error: string } {
  const str = (k: string) => (fd.get(k) ?? '').toString().trim();
  const voucherCode = str('voucherCode');
  if (!voucherCode) return { ok: false, error: 'Voucher code is required.' };
  const unitType = str('unitType');
  if (!unitType) return { ok: false, error: 'Unit type is required.' };
  const location = str('location');
  if (!location) return { ok: false, error: 'Location is required.' };

  const bedroomsRaw = str('bedrooms');
  const bedrooms = Number(bedroomsRaw);
  if (!Number.isInteger(bedrooms) || bedrooms < 0 || bedrooms > 10) {
    return { ok: false, error: 'Bedrooms must be a whole number between 0 and 10.' };
  }

  const zipRaw = str('zip');
  if (zipRaw && !/^\d{5}$/.test(zipRaw)) {
    return { ok: false, error: 'ZIP must be 5 digits.' };
  }

  const status = str('availabilityStatus') as HudVashVoucherStatus;
  if (!VALID_STATUS.includes(status)) {
    return { ok: false, error: 'Availability status is required.' };
  }

  const notes = str('notes');
  return {
    ok: true,
    value: {
      voucherCode,
      unitType,
      bedrooms,
      location,
      zip: zipRaw || null,
      accessible: str('accessible') === 'true' || fd.get('accessible') === 'on',
      availabilityStatus: status,
      notes: notes || null,
    },
  };
}

export async function createVoucherAction(fd: FormData): Promise<VoucherActionResult> {
  const actor = await requireRole(['admin']);
  const parsed = parseVoucherForm(fd);
  if (!parsed.ok) return parsed;
  await createVoucher(parsed.value, actor.id);
  revalidatePath('/app/admin/vouchers');
  return { ok: true };
}

export async function updateVoucherAction(
  voucherId: string,
  fd: FormData,
): Promise<VoucherActionResult> {
  const actor = await requireRole(['admin']);
  if (!voucherId) return { ok: false, error: 'Missing voucher id.' };
  const parsed = parseVoucherForm(fd);
  if (!parsed.ok) return parsed;
  const updated = await updateVoucher(voucherId, parsed.value, actor.id);
  if (!updated) return { ok: false, error: 'Voucher not found.' };
  revalidatePath('/app/admin/vouchers');
  return { ok: true };
}

export async function deleteVoucherAction(voucherId: string): Promise<VoucherActionResult> {
  const actor = await requireRole(['admin']);
  if (!voucherId) return { ok: false, error: 'Missing voucher id.' };
  const ok = await deleteVoucher(voucherId, actor.id);
  if (!ok) return { ok: false, error: 'Voucher not found.' };
  revalidatePath('/app/admin/vouchers');
  return { ok: true };
}
