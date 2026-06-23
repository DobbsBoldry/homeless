'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useState, useTransition } from 'react';
import { triggerVfwReferralAction } from '@/app/actions/vfw-referrals';
import { Button } from '@/components/ui/button';

/**
 * SUBP-006c — one-action "Refer to VFW Owensboro" trigger. On success the
 * printable packet link is revealed (VFW staff print it to PDF).
 */
export function VfwReferralControl({
  veteranId,
  hasReferral,
}: {
  veteranId: string;
  hasReferral: boolean;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState(false);

  const printHref = `/app/clients/veterans/${veteranId}/referral/print`;

  const trigger = () => {
    setError(null);
    startTransition(async () => {
      const r = await triggerVfwReferralAction(veteranId);
      if (!r.ok) {
        setError(r.error);
        return;
      }
      setDone(true);
      router.refresh();
    });
  };

  return (
    <div className="space-y-2">
      <div className="flex flex-wrap items-center gap-2">
        <Button type="button" size="sm" onClick={trigger} disabled={pending}>
          {pending
            ? 'Generating…'
            : hasReferral
              ? 'Re-generate referral'
              : 'Refer to VFW Owensboro'}
        </Button>
        {(hasReferral || done) && (
          <Link
            href={printHref}
            target="_blank"
            className="rounded-md border border-input px-3 py-1.5 text-xs hover:bg-muted"
          >
            Open printable packet (PDF)
          </Link>
        )}
      </div>
      {done ? (
        <p className="text-xs text-emerald-700 dark:text-emerald-400">
          Referral packet generated and logged.
        </p>
      ) : null}
      {error ? <p className="text-destructive text-xs">{error}</p> : null}
    </div>
  );
}
