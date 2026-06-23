'use client';

import { useRouter } from 'next/navigation';
import { useState, useTransition } from 'react';
import {
  createVoucherAction,
  deleteVoucherAction,
  updateVoucherAction,
} from '@/app/actions/vouchers';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
// Type-only deep import — no server code reaches the client bundle.
import type { HudVashVoucher } from '@/db/schema/hud-vash-vouchers';

const STATUSES = ['available', 'pending', 'leased'] as const;

function VoucherFields({ voucher }: { voucher?: HudVashVoucher }) {
  return (
    <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
      <div>
        <Label htmlFor="voucherCode">Voucher code</Label>
        <Input
          id="voucherCode"
          name="voucherCode"
          defaultValue={voucher?.voucherCode ?? ''}
          required
        />
      </div>
      <div>
        <Label htmlFor="unitType">Unit type</Label>
        <Input id="unitType" name="unitType" defaultValue={voucher?.unitType ?? ''} required />
      </div>
      <div>
        <Label htmlFor="bedrooms">Bedrooms</Label>
        <Input
          id="bedrooms"
          name="bedrooms"
          type="number"
          min={0}
          max={10}
          defaultValue={voucher?.bedrooms ?? 1}
          required
        />
      </div>
      <div>
        <Label htmlFor="location">Location</Label>
        <Input id="location" name="location" defaultValue={voucher?.location ?? ''} required />
      </div>
      <div>
        <Label htmlFor="zip">ZIP</Label>
        <Input id="zip" name="zip" defaultValue={voucher?.zip ?? ''} placeholder="42301" />
      </div>
      <div>
        <Label htmlFor="availabilityStatus">Availability</Label>
        <select
          id="availabilityStatus"
          name="availabilityStatus"
          defaultValue={voucher?.availabilityStatus ?? 'available'}
          className="h-9 w-full rounded-md border border-input bg-card px-2 text-sm"
        >
          {STATUSES.map((s) => (
            <option key={s} value={s}>
              {s}
            </option>
          ))}
        </select>
      </div>
      <label className="flex items-center gap-2 text-sm">
        <input
          type="checkbox"
          name="accessible"
          value="true"
          defaultChecked={voucher?.accessible ?? false}
        />
        Accessible unit
      </label>
      <div className="sm:col-span-2">
        <Label htmlFor="notes">Notes</Label>
        <Input id="notes" name="notes" defaultValue={voucher?.notes ?? ''} />
      </div>
    </div>
  );
}

export function VoucherAdmin({ vouchers }: { vouchers: HudVashVoucher[] }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [editingId, setEditingId] = useState<string | null>(null);

  const submitNew = (fd: FormData) => {
    setError(null);
    startTransition(async () => {
      const r = await createVoucherAction(fd);
      if (!r.ok) {
        setError(r.error);
        return;
      }
      router.refresh();
    });
  };

  const submitEdit = (id: string, fd: FormData) => {
    setError(null);
    startTransition(async () => {
      const r = await updateVoucherAction(id, fd);
      if (!r.ok) {
        setError(r.error);
        return;
      }
      setEditingId(null);
      router.refresh();
    });
  };

  const remove = (id: string) => {
    setError(null);
    startTransition(async () => {
      const r = await deleteVoucherAction(id);
      if (!r.ok) {
        setError(r.error);
        return;
      }
      router.refresh();
    });
  };

  return (
    <div className="space-y-6">
      {error ? <p className="text-destructive text-sm">{error}</p> : null}

      <form action={submitNew} className="rounded-md border border-border p-4">
        <h2 className="mb-3 text-sm font-semibold">Add voucher</h2>
        <VoucherFields />
        <Button type="submit" size="sm" disabled={pending} className="mt-3">
          {pending ? 'Saving…' : 'Add voucher'}
        </Button>
      </form>

      <div className="space-y-2">
        <h2 className="text-sm font-semibold">Vouchers ({vouchers.length})</h2>
        {vouchers.length === 0 ? (
          <p className="text-sm text-muted-foreground">No vouchers yet.</p>
        ) : (
          <ul className="space-y-2">
            {vouchers.map((v) => (
              <li key={v.id} className="rounded-md border border-border bg-card p-3 text-sm">
                {editingId === v.id ? (
                  <form action={(fd) => submitEdit(v.id, fd)}>
                    <VoucherFields voucher={v} />
                    <div className="mt-3 flex gap-2">
                      <Button type="submit" size="sm" disabled={pending}>
                        Save
                      </Button>
                      <Button
                        type="button"
                        size="sm"
                        variant="ghost"
                        onClick={() => setEditingId(null)}
                      >
                        Cancel
                      </Button>
                    </div>
                  </form>
                ) : (
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <div>
                      <p className="font-medium">
                        {v.unitType}{' '}
                        <span className="font-mono text-[10px] text-muted-foreground">
                          {v.voucherCode}
                        </span>
                      </p>
                      <p className="text-xs text-muted-foreground">
                        {v.location}
                        {v.zip ? ` · ${v.zip}` : ''} · {v.bedrooms}br
                        {v.accessible ? ' · accessible' : ''} · {v.availabilityStatus}
                      </p>
                    </div>
                    <div className="flex gap-2">
                      <Button size="sm" variant="outline" onClick={() => setEditingId(v.id)}>
                        Edit
                      </Button>
                      <Button
                        size="sm"
                        variant="destructive"
                        disabled={pending}
                        onClick={() => remove(v.id)}
                      >
                        Remove
                      </Button>
                    </div>
                  </div>
                )}
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}
