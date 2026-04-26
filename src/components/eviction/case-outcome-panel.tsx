'use client';

import { useState, useTransition } from 'react';
import { recordCaseOutcomeAction } from '@/app/actions/eviction';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import type { CaseOutcomeWithActor } from '@/db/queries/eviction-case-outcomes';
import type { EvictionCaseOutcome } from '@/db/schema/enums';

const OUTCOMES: Array<{ value: EvictionCaseOutcome; label: string }> = [
  { value: 'dismissed', label: 'Dismissed' },
  { value: 'judgment_for_plaintiff', label: 'Judgment for plaintiff' },
  { value: 'judgment_for_defendant', label: 'Judgment for defendant' },
  { value: 'settled', label: 'Settled' },
  { value: 'default_judgment', label: 'Default judgment' },
  { value: 'withdrawn', label: 'Withdrawn' },
];

const outcomeLabel = (v: EvictionCaseOutcome): string =>
  OUTCOMES.find((o) => o.value === v)?.label ?? v;

const outcomeBadge: Record<EvictionCaseOutcome, string> = {
  dismissed: 'bg-emerald-600/15 text-emerald-700 dark:text-emerald-400',
  judgment_for_defendant: 'bg-emerald-600/15 text-emerald-700 dark:text-emerald-400',
  settled: 'bg-secondary text-secondary-foreground',
  withdrawn: 'bg-secondary text-secondary-foreground',
  judgment_for_plaintiff: 'bg-destructive/15 text-destructive',
  default_judgment: 'bg-destructive/15 text-destructive',
};

const fmtDate = (d: Date) =>
  new Intl.DateTimeFormat('en-US', { dateStyle: 'medium', timeStyle: 'short' }).format(new Date(d));

export function CaseOutcomePanel({
  filingId,
  history,
  canRecord,
}: {
  filingId: string;
  history: CaseOutcomeWithActor[];
  canRecord: boolean;
}) {
  const [outcome, setOutcome] = useState<EvictionCaseOutcome>('settled');
  const [notes, setNotes] = useState('');
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  const onSubmit = () => {
    setError(null);
    startTransition(async () => {
      const r = await recordCaseOutcomeAction(filingId, outcome, notes);
      if (!r.ok) {
        setError(r.error);
        return;
      }
      setNotes('');
    });
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">Case outcomes</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4 text-sm">
        {canRecord ? (
          <div className="rounded-md border border-border bg-muted/30 p-3">
            <p className="mb-2 text-xs font-medium uppercase tracking-wide text-muted-foreground">
              Record outcome
            </p>
            <div className="flex flex-wrap items-end gap-2">
              <label className="flex flex-col gap-1">
                <span className="text-xs text-muted-foreground">Outcome</span>
                <select
                  value={outcome}
                  onChange={(e) => setOutcome(e.target.value as EvictionCaseOutcome)}
                  className="h-9 rounded-md border border-input bg-background px-3 text-sm"
                >
                  {OUTCOMES.map((o) => (
                    <option key={o.value} value={o.value}>
                      {o.label}
                    </option>
                  ))}
                </select>
              </label>
              <label className="flex flex-1 flex-col gap-1">
                <span className="text-xs text-muted-foreground">Notes (optional)</span>
                <input
                  type="text"
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  placeholder="Settlement terms, hearing notes…"
                  className="h-9 rounded-md border border-input bg-background px-3 text-sm"
                />
              </label>
              <Button size="sm" disabled={pending} onClick={onSubmit}>
                {pending ? 'Recording…' : 'Record'}
              </Button>
            </div>
            {error ? <p className="mt-2 text-xs text-destructive">{error}</p> : null}
          </div>
        ) : null}

        {history.length === 0 ? (
          <p className="text-muted-foreground">
            No outcomes recorded yet. {canRecord ? null : 'Only KLA attorneys can record outcomes.'}
          </p>
        ) : (
          <ul className="space-y-2">
            {history.map((row) => (
              <li
                key={row.outcome.id}
                className="rounded-md border border-border bg-card p-3 text-sm"
              >
                <div className="mb-1 flex items-center justify-between gap-2">
                  <span
                    className={`rounded px-2 py-0.5 text-xs font-medium ${outcomeBadge[row.outcome.outcome]}`}
                  >
                    {outcomeLabel(row.outcome.outcome)}
                  </span>
                  <span className="text-xs text-muted-foreground">
                    {fmtDate(row.outcome.createdAt)}
                  </span>
                </div>
                {row.outcome.notes ? <p className="text-sm">{row.outcome.notes}</p> : null}
                <p className="mt-1 text-xs text-muted-foreground">
                  Recorded by {row.actorName ?? row.actorEmail ?? '(deleted user)'}
                </p>
              </li>
            ))}
          </ul>
        )}
      </CardContent>
    </Card>
  );
}
