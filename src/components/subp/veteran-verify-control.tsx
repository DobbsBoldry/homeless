'use client';

import { useState, useTransition } from 'react';
import { setVeteranVerifiedAction } from '@/app/actions/veterans';
import { Button } from '@/components/ui/button';

/**
 * SUBP-006a — caseworker control to toggle the verified flag on a
 * self-reported veteran, requiring a reason note. VA-confirmed rows don't
 * render this (they're eligible outright).
 */
export function VeteranVerifyControl({
  veteranId,
  verified,
}: {
  veteranId: string;
  verified: boolean;
}) {
  const [open, setOpen] = useState(false);
  const [reason, setReason] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  const submit = () => {
    setError(null);
    startTransition(async () => {
      const r = await setVeteranVerifiedAction(veteranId, !verified, reason);
      if (!r.ok) {
        setError(r.error);
        return;
      }
      setOpen(false);
      setReason('');
    });
  };

  if (!open) {
    return (
      <Button size="sm" variant="outline" onClick={() => setOpen(true)}>
        {verified ? 'Mark unverified' : 'Verify veteran'}
      </Button>
    );
  }

  return (
    <div className="flex flex-col gap-1">
      <input
        type="text"
        value={reason}
        onChange={(e) => setReason(e.target.value)}
        placeholder="Reason note (required)"
        className="w-48 rounded-md border border-input bg-card px-2 py-1 text-xs"
      />
      <div className="flex items-center gap-2">
        <Button size="sm" disabled={pending} onClick={submit}>
          {pending ? '…' : verified ? 'Confirm unverify' : 'Confirm verify'}
        </Button>
        <Button
          size="sm"
          variant="ghost"
          disabled={pending}
          onClick={() => {
            setOpen(false);
            setError(null);
          }}
        >
          Cancel
        </Button>
      </div>
      {error ? <span className="text-destructive text-xs">{error}</span> : null}
    </div>
  );
}
