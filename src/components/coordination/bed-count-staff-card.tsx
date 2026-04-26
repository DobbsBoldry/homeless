'use client';

import { useId, useState, useTransition } from 'react';
import { updateBedCountAction } from '@/app/actions/coordination';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import type { ShelterWithOrg } from '@/db/queries/shelters';

const fmtTime = (d: Date) =>
  new Intl.DateTimeFormat('en-US', { dateStyle: 'medium', timeStyle: 'short' }).format(new Date(d));

export function BedCountStaffCard({
  shelter,
  lastUpdatedAt,
}: {
  shelter: ShelterWithOrg;
  lastUpdatedAt: Date | null;
}) {
  const occInputId = useId();
  const noteInputId = useId();
  const [draftOccupancy, setDraftOccupancy] = useState<number>(shelter.currentOccupancy);
  const [note, setNote] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [savedAt, setSavedAt] = useState<Date | null>(null);
  const [pending, startTransition] = useTransition();

  const free = Math.max(0, shelter.capacity - draftOccupancy);
  const isAtCapacity = draftOccupancy >= shelter.capacity;
  const isAtZero = draftOccupancy <= 0;
  const dirty = draftOccupancy !== shelter.currentOccupancy || note.trim().length > 0;

  const adjust = (delta: number) => {
    setError(null);
    setDraftOccupancy((prev) => {
      const next = prev + delta;
      if (next < 0) return 0;
      if (next > shelter.capacity) return shelter.capacity;
      return next;
    });
  };

  const onSave = () => {
    setError(null);
    startTransition(async () => {
      const r = await updateBedCountAction(shelter.id, draftOccupancy, note || null);
      if (!r.ok) {
        setError(r.error);
        return;
      }
      setNote('');
      setSavedAt(new Date());
    });
  };

  const onReset = () => {
    setDraftOccupancy(shelter.currentOccupancy);
    setNote('');
    setError(null);
  };

  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="text-base">{shelter.name}</CardTitle>
        <p className="text-xs text-muted-foreground">{shelter.partnerOrg.name}</p>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="grid grid-cols-3 gap-2 text-center">
          <div className="rounded-md border border-border bg-muted/40 p-2">
            <p className="text-xs uppercase tracking-wide text-muted-foreground">Capacity</p>
            <p className="text-lg font-semibold">{shelter.capacity}</p>
          </div>
          <div className="rounded-md border border-border bg-muted/40 p-2">
            <p className="text-xs uppercase tracking-wide text-muted-foreground">Occupied</p>
            <p className="text-lg font-semibold">{draftOccupancy}</p>
          </div>
          <div className="rounded-md border border-border bg-muted/40 p-2">
            <p className="text-xs uppercase tracking-wide text-muted-foreground">Free</p>
            <p
              className={`text-lg font-semibold ${
                free === 0 ? 'text-destructive' : 'text-emerald-600 dark:text-emerald-400'
              }`}
            >
              {free}
            </p>
          </div>
        </div>

        <div className="space-y-2">
          <Label htmlFor={occInputId} className="text-xs uppercase tracking-wide">
            New occupancy
          </Label>
          <div className="flex flex-wrap items-center gap-2">
            <Button
              type="button"
              variant="outline"
              size="lg"
              className="h-12 min-w-12"
              disabled={pending || isAtZero}
              onClick={() => adjust(-5)}
              aria-label="Decrease by 5"
            >
              −5
            </Button>
            <Button
              type="button"
              variant="outline"
              size="lg"
              className="h-12 min-w-12"
              disabled={pending || isAtZero}
              onClick={() => adjust(-1)}
              aria-label="Decrease by 1"
            >
              −1
            </Button>
            <Input
              id={occInputId}
              type="number"
              inputMode="numeric"
              min={0}
              max={shelter.capacity}
              value={draftOccupancy}
              disabled={pending}
              onChange={(e) => {
                const n = Number.parseInt(e.target.value, 10);
                if (Number.isNaN(n)) return;
                setError(null);
                setDraftOccupancy(Math.max(0, Math.min(shelter.capacity, n)));
              }}
              className="h-12 w-20 text-center text-lg font-semibold"
            />
            <Button
              type="button"
              variant="outline"
              size="lg"
              className="h-12 min-w-12"
              disabled={pending || isAtCapacity}
              onClick={() => adjust(1)}
              aria-label="Increase by 1"
            >
              +1
            </Button>
            <Button
              type="button"
              variant="outline"
              size="lg"
              className="h-12 min-w-12"
              disabled={pending || isAtCapacity}
              onClick={() => adjust(5)}
              aria-label="Increase by 5"
            >
              +5
            </Button>
          </div>
        </div>

        <div className="space-y-1">
          <Label htmlFor={noteInputId} className="text-xs uppercase tracking-wide">
            Note (optional)
          </Label>
          <Input
            id={noteInputId}
            value={note}
            onChange={(e) => setNote(e.target.value)}
            disabled={pending}
            placeholder="e.g. early intake, reservation released"
            maxLength={280}
          />
        </div>

        {error ? <p className="text-sm text-destructive">{error}</p> : null}

        <div className="flex items-center justify-between gap-2 text-xs text-muted-foreground">
          <span>
            {savedAt
              ? `Saved ${fmtTime(savedAt)}`
              : lastUpdatedAt
                ? `Last updated ${fmtTime(lastUpdatedAt)}`
                : 'No updates yet'}
          </span>
          <div className="flex gap-2">
            <Button
              type="button"
              variant="ghost"
              size="sm"
              disabled={pending || !dirty}
              onClick={onReset}
            >
              Reset
            </Button>
            <Button type="button" size="sm" disabled={pending || !dirty} onClick={onSave}>
              {pending ? 'Saving…' : 'Save'}
            </Button>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
