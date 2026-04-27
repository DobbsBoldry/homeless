'use client';

import { useState, useTransition } from 'react';
import { generatePreMeetingSummaryAction } from '@/app/actions/pre-meeting-summary';
import { Button } from '@/components/ui/button';

export function PreMeetingSummary({
  syntheticPersonRef,
  defaultDaysBack = 30,
}: {
  syntheticPersonRef: string;
  defaultDaysBack?: number;
}) {
  const [pending, startTransition] = useTransition();
  const [result, setResult] = useState<{ text: string; sinceIso: string; model: string } | null>(
    null,
  );
  const [error, setError] = useState<string | null>(null);
  const [daysBack, setDaysBack] = useState(defaultDaysBack);

  const onGenerate = () => {
    setError(null);
    startTransition(async () => {
      const r = await generatePreMeetingSummaryAction(syntheticPersonRef, daysBack);
      if (!r.ok) {
        setError(r.error);
        return;
      }
      setResult({ text: r.text, sinceIso: r.sinceIso, model: r.model });
    });
  };

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <p className="text-xs text-muted-foreground">
          What changed in the last{' '}
          <input
            type="number"
            min={1}
            max={365}
            value={daysBack}
            onChange={(e) => {
              const n = Number.parseInt(e.target.value, 10);
              if (Number.isInteger(n) && n >= 1 && n <= 365) setDaysBack(n);
            }}
            className="mx-1 inline-block w-14 rounded border border-input bg-background px-1 text-xs"
            disabled={pending}
          />{' '}
          days?
        </p>
        <Button type="button" size="sm" disabled={pending} onClick={onGenerate}>
          {pending ? 'Generating…' : result ? 'Regenerate' : 'Generate briefing'}
        </Button>
      </div>

      {error ? <p className="text-sm text-destructive">{error}</p> : null}

      {result ? (
        <div className="rounded-md border border-emerald-500/40 bg-emerald-500/5 p-4">
          <p className="text-xs uppercase tracking-wide text-emerald-700 dark:text-emerald-400">
            30-second briefing · since {result.sinceIso}
          </p>
          <article className="mt-2 space-y-2 text-sm leading-relaxed">
            {result.text.split(/\n\n+/).map((para) => (
              <p key={para.slice(0, 32)}>{para}</p>
            ))}
          </article>
          <p className="mt-3 text-[10px] uppercase tracking-wide text-muted-foreground">
            model: {result.model}
          </p>
        </div>
      ) : (
        <div className="rounded-md border border-border bg-muted/40 p-4 text-sm text-muted-foreground">
          Click <strong>Generate briefing</strong> to ask Claude to summarize what's changed for
          this person across the coalition. The briefing is two short paragraphs you can read in
          under 30 seconds.
        </div>
      )}
    </div>
  );
}
