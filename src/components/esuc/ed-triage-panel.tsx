'use client';

import Link from 'next/link';
import { useState, useTransition } from 'react';
import { type GenerateEdTriageResult, generateEdTriageAction } from '@/app/actions/care';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';

const fmtDate = (iso: string) =>
  new Intl.DateTimeFormat('en-US', { dateStyle: 'medium' }).format(new Date(iso));

const housingClass: Record<string, string> = {
  unsheltered: 'text-destructive',
  shelter: 'text-amber-700 dark:text-amber-400',
  doubled_up: 'text-amber-700 dark:text-amber-400',
  housed: 'text-emerald-700 dark:text-emerald-400',
  unknown: 'text-muted-foreground',
};

type SuccessResult = Extract<GenerateEdTriageResult, { ok: true }>;

export function EdTriagePanel() {
  const [pending, startTransition] = useTransition();
  const [data, setData] = useState<SuccessResult | null>(null);
  const [error, setError] = useState<string | null>(null);

  const onClick = () => {
    setError(null);
    startTransition(async () => {
      const r = await generateEdTriageAction();
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
          <CardTitle className="text-base">Today's priority patients</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3 text-sm">
          <p className="text-muted-foreground">
            Claude reviews the super-utilizer queue (3+ ED visits in 180 days, housing instability)
            and picks the 3-5 patients you should focus on first today. Action-blocked goes first;
            stable patients with active plans drop out.
          </p>
          <div className="flex items-center gap-3">
            <Button onClick={onClick} disabled={pending} size="sm">
              {pending ? 'Reading the queue…' : "Run today's triage"}
            </Button>
            {error ? <span className="text-xs text-destructive">{error}</span> : null}
          </div>
        </CardContent>
      </Card>
    );
  }

  const { result, candidates } = data;
  const candById = new Map(candidates.map((c) => [c.patientId, c]));
  const sortedPicks = [...result.output.picks].sort((a, b) => a.priority_rank - b.priority_rank);

  return (
    <Card>
      <CardHeader className="flex flex-row items-baseline justify-between gap-2">
        <CardTitle className="text-base">Today's priority patients</CardTitle>
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
            No patients need attention today out of {result.candidateCount} on the queue.
          </p>
        ) : (
          <ol className="space-y-3">
            {sortedPicks.map((p) => {
              const c = candById.get(p.patient_id);
              if (!c) return null;
              return (
                <li
                  key={p.patient_id}
                  className="rounded-md border border-border bg-card p-3 text-sm"
                >
                  <div className="mb-1 flex flex-wrap items-baseline justify-between gap-2">
                    <div className="flex items-baseline gap-2">
                      <span className="rounded bg-muted px-1.5 py-0.5 font-mono text-[10px]">
                        #{p.priority_rank}
                      </span>
                      <Link
                        href={`/app/care/patients/${p.patient_id}`}
                        className="font-mono text-xs font-medium hover:underline"
                      >
                        {p.patient_id}
                      </Link>
                    </div>
                    <div className="flex items-baseline gap-3 text-xs">
                      <span className="font-medium">{c.visitCount} visits</span>
                      <span className={`font-medium ${housingClass[c.housingStatus] ?? ''}`}>
                        {c.housingStatus}
                      </span>
                    </div>
                  </div>
                  <p className="text-sm leading-relaxed">{p.rationale}</p>
                  <div className="mt-1 text-[11px] text-muted-foreground">
                    last visit {fmtDate(c.latestVisitAt)} · "{c.lastChiefComplaint}" ·{' '}
                    {c.carePlanStatus ? `plan ${c.carePlanStatus}` : 'no plan drafted'}
                  </div>
                </li>
              );
            })}
          </ol>
        )}

        <div className="flex flex-wrap gap-x-4 gap-y-1 text-[11px] text-muted-foreground">
          <span>
            Reviewed {result.candidateCount} patient{result.candidateCount === 1 ? '' : 's'}
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
