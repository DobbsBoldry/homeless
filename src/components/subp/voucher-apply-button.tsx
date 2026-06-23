'use client';

import { useState, useTransition } from 'react';
import { applyToVoucherAction } from '@/app/actions/vouchers';
import { Button } from '@/components/ui/button';

/** SUBP-006b — caseworker marks a HUD-VASH voucher as applied for a veteran. */
export function VoucherApplyButton({
  veteranId,
  voucherId,
}: {
  veteranId: string;
  voucherId: string;
}) {
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  const onClick = () => {
    setError(null);
    startTransition(async () => {
      const r = await applyToVoucherAction(veteranId, voucherId);
      if (!r.ok) setError(r.error);
    });
  };

  return (
    <span className="inline-flex items-center gap-2">
      <Button size="sm" variant="outline" disabled={pending} onClick={onClick}>
        {pending ? '…' : 'Mark applied'}
      </Button>
      {error ? <span className="text-destructive text-xs">{error}</span> : null}
    </span>
  );
}
