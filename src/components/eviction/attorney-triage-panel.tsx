'use client';

import Link from 'next/link';
import { useState, useTransition } from 'react';
import {
  type GenerateAttorneyTriageResult,
  generateAttorneyTriageAction,
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

export function AttorneyTriagePanel() {
  const [pending, startTransition] = useTransition();
  const [data, setData] = useState<SuccessResult | null>(null);
  const [error, setError] = useState<string | null>(null);

  const onClick = () => {
    setError(null);
    startTransition(async () => {
      const r = await generateAttorneyTriageAction();
      if (!r.ok) {
        setError(r.error);
        return;
      }
      setData(r);
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
          <ol className="space-y-3">
            {sortedPicks.map((p) => {
              const c = candById.get(p.filing_id);
              if (!c) return null;
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
                </li>
              );
            })}
          </ol>
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
