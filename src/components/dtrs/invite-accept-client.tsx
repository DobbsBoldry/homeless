'use client';

import { useRouter } from 'next/navigation';
import { useState, useTransition } from 'react';
import { redeemPartnerInviteAction } from '@/app/actions/partner-invitations';
import { Button } from '@/components/ui/button';

/** DTRS-014a-1 — signed-in invitee redeems their academic-partner invitation. */
export function InviteAcceptClient({ token }: { token: string }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [state, setState] = useState<'idle' | 'done'>('idle');
  const [error, setError] = useState<string | null>(null);

  const accept = () => {
    setError(null);
    startTransition(async () => {
      const r = await redeemPartnerInviteAction(token);
      if (!r.ok) {
        setError(r.error);
        return;
      }
      setState('done');
      router.refresh();
    });
  };

  if (state === 'done') {
    return (
      <p className="rounded-md border border-emerald-500/40 bg-emerald-500/5 p-3 text-sm text-emerald-700 dark:text-emerald-400">
        Invitation accepted — your account now has academic-partner access.
      </p>
    );
  }

  return (
    <div className="space-y-2">
      <Button onClick={accept} disabled={pending}>
        {pending ? 'Accepting…' : 'Accept invitation'}
      </Button>
      {error ? <p className="text-destructive text-sm">{error}</p> : null}
    </div>
  );
}
