'use client';

import { useRouter } from 'next/navigation';
import { useState, useTransition } from 'react';
import { advanceApplicationStatusAction } from '@/app/actions/vfw-referrals';

/** Pipeline statuses a caseworker can move an application through. */
const STATUS_OPTIONS: { value: string; label: string }[] = [
  { value: 'applied', label: 'Applied' },
  { value: 'pending', label: 'Pending' },
  { value: 'approved', label: 'Approved' },
  { value: 'housed', label: 'Housed' },
  { value: 'withdrawn', label: 'Withdrawn' },
];

/**
 * SUBP-006c — inline status selector for a (veteran, voucher) application.
 * Persists immediately via the server action; refreshes the pipeline view.
 */
export function ApplicationStageControl({
  applicationId,
  status,
}: {
  applicationId: string;
  status: string;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  const onChange = (next: string) => {
    if (next === status) return;
    setError(null);
    startTransition(async () => {
      const r = await advanceApplicationStatusAction(applicationId, next);
      if (!r.ok) {
        setError(r.error);
        return;
      }
      router.refresh();
    });
  };

  return (
    <span className="inline-flex items-center gap-1">
      <label className="sr-only" htmlFor={`stage-${applicationId}`}>
        Application status
      </label>
      <select
        id={`stage-${applicationId}`}
        value={status}
        disabled={pending}
        onChange={(e) => onChange(e.target.value)}
        className="rounded border border-input bg-transparent px-1.5 py-0.5 text-xs outline-none focus-visible:ring-2 focus-visible:ring-ring"
      >
        {STATUS_OPTIONS.map((o) => (
          <option key={o.value} value={o.value}>
            {o.label}
          </option>
        ))}
      </select>
      {error ? <span className="text-destructive text-[10px]">{error}</span> : null}
    </span>
  );
}
