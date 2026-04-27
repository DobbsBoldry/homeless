'use client';

import { useId, useState, useTransition } from 'react';
import { addFagCompensationEntryAction } from '@/app/actions/fag';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';

export function FagEntryForm({
  memberId,
  defaultRateCents,
}: {
  memberId: string;
  defaultRateCents: number;
}) {
  const dateId = useId();
  const descId = useId();
  const hoursId = useId();
  const rateId = useId();
  const notesId = useId();
  const [occurredOn, setOccurredOn] = useState(new Date().toISOString().slice(0, 10));
  const [description, setDescription] = useState('');
  const [hours, setHours] = useState('1.0');
  const [rateDollars, setRateDollars] = useState(Math.round(defaultRateCents / 100));
  const [notes, setNotes] = useState('');
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [savedAt, setSavedAt] = useState<Date | null>(null);

  const onSubmit = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setError(null);
    const hoursTenths = Math.round(Number.parseFloat(hours) * 10);
    if (!Number.isFinite(hoursTenths) || hoursTenths <= 0) {
      setError('Enter hours as a positive decimal (e.g. 1.5).');
      return;
    }
    startTransition(async () => {
      const r = await addFagCompensationEntryAction({
        memberId,
        occurredOn,
        description,
        hoursTenths,
        hourlyRateCents: Math.max(0, Math.round(rateDollars * 100)),
        notes: notes || null,
      });
      if (!r.ok) {
        setError(r.error);
        return;
      }
      setDescription('');
      setHours('1.0');
      setNotes('');
      setSavedAt(new Date());
    });
  };

  return (
    <form onSubmit={onSubmit} className="space-y-3">
      <div className="grid gap-3 md:grid-cols-2">
        <div className="space-y-1">
          <Label htmlFor={dateId}>Date</Label>
          <Input
            id={dateId}
            type="date"
            value={occurredOn}
            onChange={(e) => setOccurredOn(e.target.value)}
            disabled={pending}
            required
          />
        </div>
        <div className="space-y-1">
          <Label htmlFor={hoursId}>Hours</Label>
          <Input
            id={hoursId}
            type="number"
            step="0.1"
            min="0.1"
            max="24"
            value={hours}
            onChange={(e) => setHours(e.target.value)}
            disabled={pending}
            required
          />
        </div>
      </div>

      <div className="space-y-1">
        <Label htmlFor={descId}>What did the advisor do?</Label>
        <Input
          id={descId}
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          placeholder='e.g. "DTRS-005 consent UX review"'
          disabled={pending}
          required
          maxLength={200}
        />
      </div>

      <div className="space-y-1">
        <Label htmlFor={rateId}>Hourly rate this entry (USD)</Label>
        <Input
          id={rateId}
          type="number"
          min={0}
          max={1000}
          value={rateDollars}
          onChange={(e) => setRateDollars(Number.parseInt(e.target.value, 10) || 0)}
          disabled={pending}
          required
        />
        <p className="text-xs text-muted-foreground">
          Defaults to the member's current rate. Edit if this entry pays a different rate.
        </p>
      </div>

      <div className="space-y-1">
        <Label htmlFor={notesId}>Notes (optional)</Label>
        <Input
          id={notesId}
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
          placeholder="payout method, transit reimbursement, etc."
          disabled={pending}
          maxLength={500}
        />
      </div>

      {error ? <p className="text-sm text-destructive">{error}</p> : null}
      {savedAt ? (
        <p className="text-sm text-emerald-700 dark:text-emerald-400">
          Saved at {new Intl.DateTimeFormat('en-US', { timeStyle: 'short' }).format(savedAt)}.
        </p>
      ) : null}

      <Button type="submit" disabled={pending}>
        {pending ? 'Saving…' : 'Add entry'}
      </Button>
    </form>
  );
}
