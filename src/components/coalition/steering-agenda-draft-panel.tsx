'use client';

import { useState, useTransition } from 'react';
import ReactMarkdown from 'react-markdown';
import { draftSteeringAgendaAction } from '@/app/actions/steering-agenda';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';

export function SteeringAgendaDraftPanel({ meetingId }: { meetingId: string }) {
  const [pending, startTransition] = useTransition();
  const [draft, setDraft] = useState<{ md: string; modelId: string; promptVersion: string } | null>(
    null,
  );
  const [error, setError] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  const onDraft = () => {
    setError(null);
    setCopied(false);
    startTransition(async () => {
      const r = await draftSteeringAgendaAction(meetingId);
      if (!r.ok) {
        setError(r.error);
        return;
      }
      setDraft({ md: r.agendaMd, modelId: r.modelId, promptVersion: r.promptVersion });
    });
  };

  const onCopy = async () => {
    if (!draft) return;
    try {
      await navigator.clipboard.writeText(draft.md);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      setError('Copy failed — select the text manually.');
    }
  };

  return (
    <Card className="border-primary/40 bg-primary/5">
      <CardHeader className="flex flex-row items-baseline justify-between gap-2">
        <CardTitle className="text-base">Draft an agenda</CardTitle>
        {draft ? (
          <Button onClick={onDraft} disabled={pending} size="sm" variant="outline">
            {pending ? 'Re-drafting…' : 'Re-draft'}
          </Button>
        ) : null}
      </CardHeader>
      <CardContent className="space-y-3 text-sm">
        {!draft ? (
          <>
            <p className="text-muted-foreground">
              Claude reads the most recent posted meeting's action items and the last 14 days of
              coalition activity, then drafts a 4-section markdown agenda you paste into the agenda
              field above. Re-run any time the docket changes.
            </p>
            <div className="flex items-center gap-3">
              <Button onClick={onDraft} disabled={pending} size="sm">
                {pending ? 'Drafting…' : 'Draft agenda'}
              </Button>
              {error ? <span className="text-xs text-destructive">{error}</span> : null}
            </div>
          </>
        ) : (
          <>
            <article className="prose prose-sm max-w-none rounded-md border border-border bg-card p-3 dark:prose-invert">
              <ReactMarkdown>{draft.md}</ReactMarkdown>
            </article>
            <div className="flex flex-wrap items-center justify-between gap-3 text-[11px] text-muted-foreground">
              <Button type="button" size="sm" variant="outline" onClick={onCopy}>
                {copied ? 'Copied ✓' : 'Copy markdown'}
              </Button>
              <span>
                Model: <span className="font-mono">{draft.modelId}</span> · Prompt:{' '}
                <span className="font-mono">{draft.promptVersion}</span>
              </span>
              {error ? <span className="w-full text-destructive">{error}</span> : null}
            </div>
          </>
        )}
      </CardContent>
    </Card>
  );
}
