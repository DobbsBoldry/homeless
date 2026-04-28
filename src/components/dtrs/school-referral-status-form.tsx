'use client';

/**
 * COOR-014 — Status-update form for the caseworker referral detail page.
 *
 * Lets a caseworker or admin advance a referral's status and attach an
 * optional confirmation note that the school liaison will see on their
 * closed-loop dashboard.
 */

import { useId, useState, useTransition } from 'react';
import { updateReferralStatusAction } from '@/app/actions/school-referral-status';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
// Deep import: 'use client' files are exempt from the barrel rule (ADR 0001 / FND-040b).
import type { SchoolReferralStatus } from '@/db/schema/enums';

const STATUS_OPTIONS: { value: SchoolReferralStatus; label: string }[] = [
  { value: 'received', label: 'Received' },
  { value: 'triaged', label: 'Triaged' },
  { value: 'in_progress', label: 'In progress' },
  { value: 'connected', label: 'Connected' },
  { value: 'closed_unreachable', label: 'Closed — unreachable' },
  { value: 'closed_completed', label: 'Closed — completed' },
];

interface Props {
  referralId: string;
  currentStatus: SchoolReferralStatus;
}

export function SchoolReferralStatusForm({ referralId, currentStatus }: Props) {
  const formId = useId();
  const [isPending, startTransition] = useTransition();

  const [selectedStatus, setSelectedStatus] = useState<SchoolReferralStatus>(currentStatus);
  const [note, setNote] = useState('');
  const [result, setResult] = useState<{ ok: true } | { ok: false; error: string } | null>(null);

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setResult(null);
    startTransition(async () => {
      const res = await updateReferralStatusAction(
        referralId,
        selectedStatus,
        note.trim() || undefined,
      );
      setResult(res);
      if (res.ok) setNote('');
    });
  }

  return (
    <form id={formId} onSubmit={handleSubmit} className="space-y-4">
      <div className="space-y-1.5">
        <Label htmlFor={`${formId}-status`}>New status</Label>
        <select
          id={`${formId}-status`}
          value={selectedStatus}
          onChange={(e) => setSelectedStatus(e.target.value as SchoolReferralStatus)}
          className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
          disabled={isPending}
        >
          {STATUS_OPTIONS.map((opt) => (
            <option key={opt.value} value={opt.value}>
              {opt.label}
            </option>
          ))}
        </select>
      </div>

      <div className="space-y-1.5">
        <Label htmlFor={`${formId}-note`}>
          Confirmation note{' '}
          <span className="text-muted-foreground font-normal">(optional — visible to liaison)</span>
        </Label>
        <textarea
          id={`${formId}-note`}
          value={note}
          onChange={(e) => setNote(e.target.value)}
          maxLength={500}
          rows={3}
          placeholder="e.g. Connected to Boulware Mission shelter, intake scheduled Friday."
          className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm resize-none"
          disabled={isPending}
        />
        <p className="text-xs text-muted-foreground text-right">{note.length}/500</p>
      </div>

      {result && !result.ok && (
        <p className="text-sm text-destructive" role="alert">
          {result.error}
        </p>
      )}
      {result?.ok && (
        <p className="text-sm text-green-700 dark:text-green-400" role="status">
          Status updated.
        </p>
      )}

      <Button type="submit" disabled={isPending || selectedStatus === currentStatus}>
        {isPending ? 'Saving…' : 'Save status'}
      </Button>
    </form>
  );
}
