'use client';

import { useRouter } from 'next/navigation';
import { useId, useState, useTransition } from 'react';
import { saveFagMemberAction } from '@/app/actions/fag';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import type { FagMemberStatus } from '@/db/schema/enums';

const STATUS_OPTIONS: FagMemberStatus[] = ['active', 'paused', 'ended'];

export function FagMemberForm({
  initial,
}: {
  initial?: {
    id: string;
    fullName: string;
    role: string;
    contactPhone: string | null;
    contactEmail: string | null;
    hourlyRateCents: number;
    status: FagMemberStatus;
    notes: string | null;
    onboardedOn: string | null;
  };
}) {
  const router = useRouter();
  const nameId = useId();
  const roleId = useId();
  const phoneId = useId();
  const emailId = useId();
  const rateId = useId();
  const statusId = useId();
  const onboardedId = useId();
  const notesId = useId();
  const [fullName, setFullName] = useState(initial?.fullName ?? '');
  const [role, setRole] = useState(initial?.role ?? 'lived-experience advisor');
  const [phone, setPhone] = useState(initial?.contactPhone ?? '');
  const [email, setEmail] = useState(initial?.contactEmail ?? '');
  const [rateDollars, setRateDollars] = useState(
    Math.round((initial?.hourlyRateCents ?? 10_000) / 100),
  );
  const [status, setStatus] = useState<FagMemberStatus>(initial?.status ?? 'active');
  const [onboardedOn, setOnboardedOn] = useState(initial?.onboardedOn ?? '');
  const [notes, setNotes] = useState(initial?.notes ?? '');
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  const onSubmit = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setError(null);
    startTransition(async () => {
      const r = await saveFagMemberAction({
        id: initial?.id,
        fullName,
        role,
        contactPhone: phone || null,
        contactEmail: email || null,
        hourlyRateCents: Math.max(0, Math.round(rateDollars * 100)),
        status,
        notes: notes || null,
        onboardedOn: onboardedOn || null,
      });
      if (!r.ok) {
        setError(r.error);
        return;
      }
      router.push(`/app/coalition/fag/${r.id}`);
    });
  };

  return (
    <form onSubmit={onSubmit} className="space-y-4">
      <div className="grid gap-3 md:grid-cols-2">
        <div className="space-y-1">
          <Label htmlFor={nameId}>Full name</Label>
          <Input
            id={nameId}
            value={fullName}
            onChange={(e) => setFullName(e.target.value)}
            disabled={pending}
            required
            maxLength={80}
          />
        </div>
        <div className="space-y-1">
          <Label htmlFor={roleId}>Role label</Label>
          <Input
            id={roleId}
            value={role}
            onChange={(e) => setRole(e.target.value)}
            disabled={pending}
            required
            maxLength={60}
          />
        </div>
      </div>

      <div className="grid gap-3 md:grid-cols-2">
        <div className="space-y-1">
          <Label htmlFor={phoneId}>Phone (optional)</Label>
          <Input
            id={phoneId}
            value={phone}
            onChange={(e) => setPhone(e.target.value)}
            disabled={pending}
          />
        </div>
        <div className="space-y-1">
          <Label htmlFor={emailId}>Email (optional)</Label>
          <Input
            id={emailId}
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            disabled={pending}
          />
        </div>
      </div>

      <div className="grid gap-3 md:grid-cols-3">
        <div className="space-y-1">
          <Label htmlFor={rateId}>Hourly rate (USD)</Label>
          <Input
            id={rateId}
            type="number"
            min={0}
            max={1000}
            step={5}
            value={rateDollars}
            onChange={(e) => setRateDollars(Number.parseInt(e.target.value, 10) || 0)}
            disabled={pending}
            required
          />
          <p className="text-xs text-muted-foreground">
            Default $100/hr per Strategy Funding policy.
          </p>
        </div>
        <div className="space-y-1">
          <Label htmlFor={statusId}>Status</Label>
          <select
            id={statusId}
            value={status}
            onChange={(e) => setStatus(e.target.value as FagMemberStatus)}
            disabled={pending}
            className="h-9 w-full rounded-md border border-input bg-background px-3 text-sm"
          >
            {STATUS_OPTIONS.map((s) => (
              <option key={s} value={s}>
                {s}
              </option>
            ))}
          </select>
        </div>
        <div className="space-y-1">
          <Label htmlFor={onboardedId}>Onboarded on</Label>
          <Input
            id={onboardedId}
            type="date"
            value={onboardedOn}
            onChange={(e) => setOnboardedOn(e.target.value)}
            disabled={pending}
          />
        </div>
      </div>

      <div className="space-y-1">
        <Label htmlFor={notesId}>Notes (accommodations, scheduling, etc.)</Label>
        <textarea
          id={notesId}
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
          rows={4}
          maxLength={500}
          disabled={pending}
          className="w-full rounded-md border border-input bg-background p-2 text-sm"
        />
      </div>

      {error ? <p className="text-sm text-destructive">{error}</p> : null}

      <Button type="submit" disabled={pending}>
        {pending ? 'Saving…' : initial ? 'Save changes' : 'Add advisor'}
      </Button>
    </form>
  );
}
