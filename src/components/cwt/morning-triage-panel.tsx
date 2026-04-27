'use client';

import Link from 'next/link';
import { useState, useTransition } from 'react';
import {
  type CwtTriageCandidateMeta,
  type GenerateCwtTriageResult,
  generateCwtTriageAction,
} from '@/app/actions/cwt-triage';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';

const fmtDate = (iso: string) =>
  new Intl.DateTimeFormat('en-US', { dateStyle: 'medium' }).format(new Date(iso));

const urgencyClass: Record<string, string> = {
  today: 'text-destructive',
  within_7_days: 'text-amber-700 dark:text-amber-400',
  within_30_days: 'text-muted-foreground',
  not_urgent: 'text-muted-foreground',
};

type SuccessResult = Extract<GenerateCwtTriageResult, { ok: true }>;

export function MorningTriagePanel() {
  const [pending, startTransition] = useTransition();
  const [data, setData] = useState<SuccessResult | null>(null);
  const [error, setError] = useState<string | null>(null);

  const onClick = () => {
    setError(null);
    startTransition(async () => {
      const r = await generateCwtTriageAction();
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
          <CardTitle className="text-base">Today's caseworker priorities</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3 text-sm">
          <p className="text-muted-foreground">
            Claude reads recent extracted intakes plus people who touched ≥2 partners in the last
            two weeks, and picks the 3-5 you should focus on first today. DV-flagged goes first;
            "today/within-7-days" urgency before "within-30-days"; cross-partner patterns where the
            platform earns its keep.
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
  const candById = new Map(candidates.map((c) => [c.candidateId, c]));
  const sortedPicks = [...result.output.picks].sort((a, b) => a.priority_rank - b.priority_rank);

  return (
    <Card>
      <CardHeader className="flex flex-row items-baseline justify-between gap-2">
        <CardTitle className="text-base">Today's caseworker priorities</CardTitle>
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
            No candidates need attention today out of {result.candidateCount} on the queue.
          </p>
        ) : (
          <ol className="space-y-3">
            {sortedPicks.map((p) => {
              const c = candById.get(p.candidate_id);
              if (!c) return null;
              return (
                <li
                  key={p.candidate_id}
                  className="rounded-md border border-border bg-card p-3 text-sm"
                >
                  <PickHeader pick={p} candidate={c} />
                  <p className="text-sm leading-relaxed">{p.rationale}</p>
                  <PickFooter candidate={c} />
                </li>
              );
            })}
          </ol>
        )}

        <div className="flex flex-wrap gap-x-4 gap-y-1 text-[11px] text-muted-foreground">
          <span>
            Reviewed {result.candidateCount} candidate{result.candidateCount === 1 ? '' : 's'}
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

function PickHeader({
  pick,
  candidate,
}: {
  pick: { candidate_id: string; priority_rank: number; kind: 'intake' | 'person' };
  candidate: CwtTriageCandidateMeta;
}) {
  const href =
    candidate.kind === 'intake'
      ? `/app/clients/intakes/${candidate.candidateId}`
      : `/app/clients/person/${candidate.candidateId}`;
  const label =
    candidate.kind === 'intake'
      ? (candidate.label ?? candidate.candidateId)
      : candidate.candidateId;

  return (
    <div className="mb-1 flex flex-wrap items-baseline justify-between gap-2">
      <div className="flex items-baseline gap-2">
        <span className="rounded bg-muted px-1.5 py-0.5 font-mono text-[10px]">
          #{pick.priority_rank}
        </span>
        <span className="rounded border border-border px-1.5 py-0.5 text-[10px] uppercase tracking-wide">
          {pick.kind}
        </span>
        <Link href={href} className="font-mono text-xs font-medium hover:underline">
          {label}
        </Link>
      </div>
      <div className="flex items-baseline gap-3 text-xs">
        {candidate.kind === 'intake' && candidate.urgency ? (
          <span className={`font-medium ${urgencyClass[candidate.urgency] ?? ''}`}>
            {candidate.urgency}
          </span>
        ) : null}
        {candidate.kind === 'person' && candidate.partners ? (
          <span className="font-medium">{candidate.partners} partners</span>
        ) : null}
      </div>
    </div>
  );
}

function PickFooter({ candidate }: { candidate: CwtTriageCandidateMeta }) {
  if (candidate.kind === 'intake') {
    const flags = candidate.flags ?? [];
    return (
      <div className="mt-1 text-[11px] text-muted-foreground">
        {candidate.createdAt ? `extracted ${fmtDate(candidate.createdAt)}` : ''}
        {candidate.presenting ? ` · "${candidate.presenting}"` : ''}
        {flags.length > 0 ? ` · flags: ${flags.join(', ')}` : ''}
      </div>
    );
  }
  return (
    <div className="mt-1 text-[11px] text-muted-foreground">
      {candidate.events ?? 0} events ·{' '}
      {candidate.latestEventAt ? `latest ${fmtDate(candidate.latestEventAt)}` : ''}
      {candidate.orgNames && candidate.orgNames.length > 0
        ? ` · ${candidate.orgNames.join(' · ')}`
        : ''}
    </div>
  );
}
