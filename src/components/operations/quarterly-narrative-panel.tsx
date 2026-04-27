'use client';

import { useState, useTransition } from 'react';
import { generateQuarterlyNarrativeAction } from '@/app/actions/quarterly-narrative';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';

export function QuarterlyNarrativePanel({
  year,
  quarter,
}: {
  year: number;
  quarter: 1 | 2 | 3 | 4;
}) {
  const [pending, startTransition] = useTransition();
  const [data, setData] = useState<{ text: string; modelId: string; promptVersion: string } | null>(
    null,
  );
  const [error, setError] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  const onClick = () => {
    setError(null);
    setCopied(false);
    startTransition(async () => {
      const r = await generateQuarterlyNarrativeAction(year, quarter);
      if (!r.ok) {
        setError(r.error);
        return;
      }
      setData({ text: r.text, modelId: r.modelId, promptVersion: r.promptVersion });
    });
  };

  const onCopy = async () => {
    if (!data) return;
    try {
      await navigator.clipboard.writeText(data.text);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      setError('Copy failed — select the text manually.');
    }
  };

  return (
    <Card>
      <CardHeader className="flex flex-row items-baseline justify-between gap-2">
        <CardTitle className="text-base">Plain-English narrative</CardTitle>
        {data ? (
          <Button onClick={onClick} disabled={pending} size="sm" variant="outline">
            {pending ? 'Re-drafting…' : 'Re-draft'}
          </Button>
        ) : null}
      </CardHeader>
      <CardContent className="space-y-3 text-sm">
        {!data ? (
          <>
            <p className="text-muted-foreground">
              Claude reads the same suppression-safe aggregates above and writes a 3-4 paragraph
              prose summary suitable for a community newsletter, Fiscal Court appendix, or partner
              email update. Counts under 5 stay suppressed (printed as "fewer than 5") rather than
              padded.
            </p>
            <div className="flex items-center gap-3">
              <Button onClick={onClick} disabled={pending} size="sm">
                {pending ? 'Drafting…' : 'Draft narrative'}
              </Button>
              {error ? <span className="text-xs text-destructive">{error}</span> : null}
            </div>
          </>
        ) : (
          <>
            <p className="whitespace-pre-wrap leading-relaxed">{data.text}</p>
            <div className="flex flex-wrap items-center justify-between gap-3 text-[11px] text-muted-foreground">
              <Button type="button" size="sm" variant="outline" onClick={onCopy}>
                {copied ? 'Copied ✓' : 'Copy text'}
              </Button>
              <span>
                Model: <span className="font-mono">{data.modelId}</span> · Prompt:{' '}
                <span className="font-mono">{data.promptVersion}</span>
              </span>
              {error ? <span className="w-full text-destructive">{error}</span> : null}
            </div>
          </>
        )}
      </CardContent>
    </Card>
  );
}
