'use client';

import Link from 'next/link';
import { useState, useTransition } from 'react';
import {
  type BatchOutreachItem,
  type GenerateAttorneyTriageResult,
  generateAttorneyTriageAction,
  generateOutreachLettersBatchAction,
} from '@/app/actions/eviction';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { riskBandClass } from '@/lib/eviction/risk-band';

const fmtMoney = (cents: number | null) => {
  if (cents == null) return '—';
  return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(cents / 100);
};

const fmtDate = (iso: string) =>
  new Intl.DateTimeFormat('en-US', { dateStyle: 'medium' }).format(new Date(iso));

type SuccessResult = Extract<GenerateAttorneyTriageResult, { ok: true }>;

function BatchLetterBlock({ filingId, letter }: { filingId: string; letter: BatchOutreachItem }) {
  const [text, setText] = useState(letter.ok ? letter.text : '');
  const [copied, setCopied] = useState(false);
  const [copyError, setCopyError] = useState<string | null>(null);

  if (!letter.ok) {
    return (
      <p className="mt-3 rounded-md border border-destructive/40 bg-destructive/5 p-2 text-xs text-destructive">
        Couldn't draft outreach for this filing: {letter.error}
      </p>
    );
  }

  const onCopy = async () => {
    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      setCopyError('Copy failed — select the text manually.');
    }
  };

  return (
    <div className="mt-3 space-y-2 rounded-md border border-primary/40 bg-primary/5 p-2">
      <p className="text-[11px] uppercase tracking-wide text-muted-foreground">
        Outreach letter draft
      </p>
      <textarea
        value={text}
        onChange={(e) => setText(e.target.value)}
        rows={10}
        className="w-full rounded-md border border-input bg-background p-2 font-mono text-[11px] leading-relaxed"
        aria-label={`Outreach letter draft for ${filingId}`}
      />
      <div className="flex flex-wrap items-center gap-3 text-xs text-muted-foreground">
        <Button type="button" size="sm" variant="outline" onClick={onCopy}>
          {copied ? 'Copied ✓' : 'Copy'}
        </Button>
        <span>{text.length} chars</span>
        {copyError ? <span className="text-destructive">{copyError}</span> : null}
      </div>
    </div>
  );
}

export function AttorneyTriagePanel() {
  const [pending, startTransition] = useTransition();
  const [batchPending, startBatchTransition] = useTransition();
  const [data, setData] = useState<SuccessResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [batchError, setBatchError] = useState<string | null>(null);
  const [outreachByFiling, setOutreachByFiling] = useState<Record<string, BatchOutreachItem>>({});

  const onClick = () => {
    setError(null);
    startTransition(async () => {
      const r = await generateAttorneyTriageAction();
      if (!r.ok) {
        setError(r.error);
        return;
      }
      setData(r);
      setOutreachByFiling({});
      setBatchError(null);
    });
  };

  const onBatchOutreach = (filingIds: string[]) => {
    setBatchError(null);
    startBatchTransition(async () => {
      const r = await generateOutreachLettersBatchAction(filingIds);
      if (!r.ok) {
        setBatchError(r.error);
        return;
      }
      const next: Record<string, BatchOutreachItem> = {};
      for (const item of r.items) next[item.filingId] = item;
      setOutreachByFiling(next);
    });
  };

  if (!data) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Today's priority cases</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3 text-sm">
          <p className="text-muted-foreground">
            Claude reviews every open case in the last 30 days and picks the 3-5 you should focus on
            first today. The reasoning isn't your risk score restated — it's "where's the time
            pressure, where's the highest leverage."
          </p>
          <div className="flex items-center gap-3">
            <Button onClick={onClick} disabled={pending} size="sm">
              {pending ? 'Reviewing the docket…' : "Run today's triage"}
            </Button>
            {error ? <span className="text-destructive text-xs">{error}</span> : null}
          </div>
        </CardContent>
      </Card>
    );
  }

  const { result, candidates } = data;
  const candById = new Map(candidates.map((c) => [c.filingId, c]));
  const sortedPicks = [...result.output.picks].sort((a, b) => a.priority_rank - b.priority_rank);

  return (
    <Card>
      <CardHeader className="flex flex-row items-baseline justify-between gap-2">
        <CardTitle className="text-base">Today's priority cases</CardTitle>
        <Button onClick={onClick} disabled={pending} size="sm" variant="outline">
          {pending ? 'Re-running…' : 'Re-run triage'}
        </Button>
      </CardHeader>
      <CardContent className="space-y-4 text-sm">
        {result.output.overall_note ? (
          <p className="rounded-md border border-primary/40 bg-primary/5 p-3 text-sm">
            {result.output.overall_note}
          </p>
        ) : null}

        {sortedPicks.length === 0 ? (
          <p className="text-muted-foreground">
            No cases need attention today out of {result.candidateCount} open in the window.
          </p>
        ) : (
          <>
            <div className="flex flex-wrap items-center gap-3 rounded-md border border-primary/40 bg-primary/5 p-3">
              <div className="flex-1 text-xs text-muted-foreground">
                Draft a tenant outreach letter for every pick at once. Each one is fully editable
                inline; you copy the text into your real mail tool.
              </div>
              <Button
                onClick={() => onBatchOutreach(sortedPicks.map((p) => p.filing_id))}
                disabled={batchPending}
                size="sm"
              >
                {batchPending
                  ? `Drafting ${sortedPicks.length}…`
                  : `Draft outreach for all ${sortedPicks.length}`}
              </Button>
              {batchError ? (
                <span className="w-full text-xs text-destructive">{batchError}</span>
              ) : null}
            </div>
            <ol className="space-y-3">
              {sortedPicks.map((p) => {
                const c = candById.get(p.filing_id);
                if (!c) return null;
                const letter = outreachByFiling[p.filing_id];
                return (
                  <li
                    key={p.filing_id}
                    className="rounded-md border border-border bg-card p-3 text-sm"
                  >
                    <div className="mb-1 flex flex-wrap items-baseline justify-between gap-2">
                      <div className="flex items-baseline gap-2">
                        <span className="rounded bg-muted px-1.5 py-0.5 font-mono text-[10px]">
                          #{p.priority_rank}
                        </span>
                        <Link
                          href={`/app/cases/filings/${p.filing_id}`}
                          className="font-mono text-xs font-medium hover:underline"
                        >
                          {c.caseNumber}
                        </Link>
                        <span className="text-xs text-muted-foreground">{c.causeType}</span>
                      </div>
                      <div className="flex items-baseline gap-3 text-xs">
                        {c.score != null ? (
                          <span className={`font-medium ${riskBandClass(c.score)}`}>
                            score {c.score}
                          </span>
                        ) : (
                          <span className="text-muted-foreground italic">unscored</span>
                        )}
                        <span className="text-muted-foreground">
                          {fmtMoney(c.amountClaimedCents)}
                        </span>
                      </div>
                    </div>
                    <p className="text-sm leading-relaxed">{p.rationale}</p>
                    <div className="mt-1 text-[11px] text-muted-foreground">
                      filed {fmtDate(c.filedAt)} · status {c.status} ·{' '}
                      {c.packetStatus ? `packet ${c.packetStatus}` : 'no packet drafted'}
                    </div>
                    {letter ? (
                      <BatchLetterBlock filingId={p.filing_id} letter={letter} />
                    ) : batchPending ? (
                      <p className="mt-3 rounded-md border border-dashed border-border bg-muted/30 p-2 text-xs text-muted-foreground italic">
                        Drafting outreach letter…
                      </p>
                    ) : null}
                  </li>
                );
              })}
            </ol>
          </>
        )}

        <div className="flex flex-wrap gap-x-4 gap-y-1 text-[11px] text-muted-foreground">
          <span>
            Reviewed {result.candidateCount} open case{result.candidateCount === 1 ? '' : 's'}
          </span>
          <span>
            Model: <span className="font-mono">{result.modelId}</span>
          </span>
          <span>
            Prompt: <span className="font-mono">{result.promptVersion}</span>
          </span>
        </div>
      </CardContent>
    </Card>
  );
}
