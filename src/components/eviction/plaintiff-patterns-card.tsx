'use client';

import { useState, useTransition } from 'react';
import { commentOnPlaintiffPatternsAction } from '@/app/actions/eviction';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import type { TopPlaintiff } from '@/db/queries/eviction-filings';

const fmtDate = (d: Date | string) =>
  new Intl.DateTimeFormat('en-US', { dateStyle: 'medium' }).format(new Date(d));

export function PlaintiffPatternsCard({
  initialPlaintiffs,
  windowDays,
  minCount,
}: {
  initialPlaintiffs: TopPlaintiff[];
  windowDays: number;
  minCount: number;
}) {
  const [pending, startTransition] = useTransition();
  const [commentary, setCommentary] = useState<{
    text: string;
    modelId: string;
    promptVersion: string;
  } | null>(null);
  const [error, setError] = useState<string | null>(null);

  const onComment = () => {
    setError(null);
    startTransition(async () => {
      const r = await commentOnPlaintiffPatternsAction();
      if (!r.ok) {
        setError(r.error);
        return;
      }
      setCommentary({ text: r.text, modelId: r.modelId, promptVersion: r.promptVersion });
    });
  };

  return (
    <Card>
      <CardHeader className="flex flex-row items-baseline justify-between gap-2">
        <CardTitle className="text-base">
          Bulk filers (last {windowDays} days, ≥{minCount} cases)
        </CardTitle>
        <Button onClick={onComment} disabled={pending} size="sm" variant="outline">
          {pending ? 'Asking…' : commentary ? 'Re-comment' : 'Ask Claude'}
        </Button>
      </CardHeader>
      <CardContent className="space-y-3 text-sm">
        {initialPlaintiffs.length === 0 ? (
          <p className="text-muted-foreground">
            No plaintiff filed {minCount} or more cases in the last {windowDays} days.
          </p>
        ) : (
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border text-left text-xs uppercase tracking-wide text-muted-foreground">
                <th className="py-2">Plaintiff</th>
                <th className="py-2 text-right">Filings</th>
                <th className="py-2 text-right">Earliest</th>
                <th className="py-2 text-right">Latest</th>
              </tr>
            </thead>
            <tbody>
              {initialPlaintiffs.map((p) => (
                <tr key={p.plaintiff} className="border-b border-border last:border-0">
                  <td className="py-2 pr-2 font-medium">{p.plaintiff}</td>
                  <td className="py-2 text-right tabular-nums">{p.filings}</td>
                  <td className="py-2 text-right text-muted-foreground">{fmtDate(p.earliest)}</td>
                  <td className="py-2 text-right text-muted-foreground">{fmtDate(p.latest)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}

        {commentary ? (
          <div className="rounded-md border border-primary/40 bg-primary/5 p-3 text-sm">
            <p className="mb-1 text-[10px] uppercase tracking-wide text-muted-foreground">
              Claude's read
            </p>
            <p className="leading-relaxed">{commentary.text}</p>
            <p className="mt-2 text-[11px] text-muted-foreground">
              Model: <span className="font-mono">{commentary.modelId}</span> · Prompt:{' '}
              <span className="font-mono">{commentary.promptVersion}</span>
            </p>
          </div>
        ) : null}

        {error ? <p className="text-xs text-destructive">{error}</p> : null}
      </CardContent>
    </Card>
  );
}
