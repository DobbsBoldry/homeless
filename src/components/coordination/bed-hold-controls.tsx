'use client';

import { useId, useState, useTransition } from 'react';
import { createBedHoldAction, releaseBedHoldAction } from '@/app/actions/coordination';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import type { BedHoldWithHolder } from '@/db/queries/shelters';

const fmtTime = (d: Date) =>
  new Intl.DateTimeFormat('en-US', { timeStyle: 'short' }).format(new Date(d));

const minutesFromNow = (d: Date): number =>
  Math.max(0, Math.round((new Date(d).getTime() - Date.now()) / 60_000));

export function BedHoldControls({
  shelterId,
  shelterName,
  freeBeds,
  activeHolds,
  canHold,
}: {
  shelterId: string;
  shelterName: string;
  freeBeds: number;
  activeHolds: BedHoldWithHolder[];
  canHold: boolean;
}) {
  const labelId = useId();
  const noteId = useId();
  const [open, setOpen] = useState(false);
  const [label, setLabel] = useState('');
  const [note, setNote] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  const onCreate = () => {
    setError(null);
    startTransition(async () => {
      const r = await createBedHoldAction(shelterId, label, note || null);
      if (!r.ok) {
        setError(r.error);
        return;
      }
      setLabel('');
      setNote('');
      setOpen(false);
    });
  };

  const onRelease = (id: string) => {
    setError(null);
    startTransition(async () => {
      const r = await releaseBedHoldAction(id);
      if (!r.ok) setError(r.error);
    });
  };

  const cannotCreate = !canHold || freeBeds <= 0;

  return (
    <div className="space-y-2 border-t border-border pt-3 text-sm">
      <div className="flex items-center justify-between gap-2">
        <p className="text-xs uppercase tracking-wide text-muted-foreground">
          Holds{' '}
          <span className="text-foreground">
            {activeHolds.length}
            {activeHolds.length > 0 ? ' active' : ''}
          </span>
        </p>
        {canHold ? (
          <Button
            type="button"
            size="sm"
            variant={open ? 'ghost' : 'outline'}
            disabled={pending || (cannotCreate && !open)}
            onClick={() => setOpen((v) => !v)}
            title={cannotCreate ? 'No free beds to hold' : `Hold a bed at ${shelterName}`}
          >
            {open ? 'Cancel' : 'Hold a bed'}
          </Button>
        ) : null}
      </div>

      {activeHolds.length > 0 ? (
        <ul className="space-y-1 text-xs">
          {activeHolds.map((h) => {
            const mins = minutesFromNow(h.expiresAt);
            return (
              <li
                key={h.id}
                className="flex items-center justify-between gap-2 rounded bg-muted/40 px-2 py-1"
              >
                <span className="truncate">
                  <span className="font-medium">{h.personLabel}</span>
                  <span className="text-muted-foreground">
                    {' '}
                    · expires {fmtTime(h.expiresAt)} ({mins}m)
                  </span>
                </span>
                {canHold ? (
                  <Button
                    type="button"
                    size="sm"
                    variant="ghost"
                    disabled={pending}
                    onClick={() => onRelease(h.id)}
                  >
                    Release
                  </Button>
                ) : null}
              </li>
            );
          })}
        </ul>
      ) : null}

      {open ? (
        <div className="space-y-2 rounded border border-border bg-card p-3">
          <div className="space-y-1">
            <Label htmlFor={labelId} className="text-xs uppercase tracking-wide">
              Hold for
            </Label>
            <Input
              id={labelId}
              value={label}
              maxLength={80}
              disabled={pending}
              placeholder='e.g. "211 caller #1234"'
              onChange={(e) => setLabel(e.target.value)}
            />
          </div>
          <div className="space-y-1">
            <Label htmlFor={noteId} className="text-xs uppercase tracking-wide">
              Note (optional)
            </Label>
            <Input
              id={noteId}
              value={note}
              maxLength={280}
              disabled={pending}
              placeholder="walking from downtown, ETA 30 min"
              onChange={(e) => setNote(e.target.value)}
            />
          </div>
          {error ? <p className="text-xs text-destructive">{error}</p> : null}
          <div className="flex justify-end">
            <Button
              type="button"
              size="sm"
              disabled={pending || cannotCreate || label.trim().length === 0}
              onClick={onCreate}
            >
              {pending ? 'Saving…' : 'Hold for 90 min'}
            </Button>
          </div>
        </div>
      ) : error && activeHolds.length > 0 ? (
        <p className="text-xs text-destructive">{error}</p>
      ) : null}
    </div>
  );
}
