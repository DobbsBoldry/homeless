'use client';

import { useState, useTransition } from 'react';
import { scoreFilingAction } from '@/app/actions/eviction';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import type { EvictionFilingRiskScore } from '@/db/schema/eviction-filing-risk-scores';
import type { EvictionFiling } from '@/db/schema/eviction-filings';
import { riskBandClass, riskBandLabel } from '@/lib/eviction/risk-band';

const fmtDate = (d: Date) =>
  new Intl.DateTimeFormat('en-US', { dateStyle: 'long', timeStyle: 'short' }).format(new Date(d));

const fmtMoney = (cents: number | null) => {
  if (cents == null) return '—';
  return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(cents / 100);
};

const causeLabel: Record<EvictionFiling['causeType'], string> = {
  non_payment: 'Non-payment of rent',
  lease_violation: 'Lease violation',
  holdover: 'Holdover',
  other: 'Other',
};

const statusClass: Record<EvictionFiling['status'], string> = {
  filed: 'bg-secondary text-secondary-foreground',
  served: 'bg-accent text-accent-foreground',
  judgment: 'bg-destructive/15 text-destructive',
  dismissed: 'bg-muted text-muted-foreground',
  sealed: 'bg-muted text-muted-foreground italic',
};

export function FilingDetail({
  filing,
  score,
}: {
  filing: EvictionFiling;
  score: EvictionFilingRiskScore | null;
}) {
  const [showFullName, setShowFullName] = useState(false);
  const [showRawJson, setShowRawJson] = useState(false);

  const initials = `${filing.defendantFirstName.charAt(0).toUpperCase()}.${filing.defendantLastName.charAt(0).toUpperCase()}.`;
  const fullName = `${filing.defendantFirstName} ${filing.defendantLastName}`;

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between gap-4">
            <div className="space-y-1">
              <CardTitle className="font-mono text-xl">{filing.caseNumber}</CardTitle>
              <p className="text-sm text-muted-foreground">{filing.plaintiff}</p>
            </div>
            <span className={`rounded px-2 py-1 text-xs ${statusClass[filing.status]}`}>
              {filing.status}
            </span>
          </div>
        </CardHeader>
        <CardContent className="grid grid-cols-2 gap-x-6 gap-y-3 text-sm">
          <div>
            <div className="text-xs uppercase tracking-wide text-muted-foreground">Defendant</div>
            <div className="flex items-center gap-2">
              <span>{showFullName ? fullName : initials}</span>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setShowFullName((v) => !v)}
                aria-pressed={showFullName}
                className="h-6 px-2 text-xs"
              >
                {showFullName ? 'hide' : 'show'}
              </Button>
            </div>
          </div>
          <div>
            <div className="text-xs uppercase tracking-wide text-muted-foreground">Address</div>
            <div>{filing.defendantAddress ?? <span className="text-muted-foreground">—</span>}</div>
          </div>
          <div>
            <div className="text-xs uppercase tracking-wide text-muted-foreground">Cause</div>
            <div>{causeLabel[filing.causeType]}</div>
          </div>
          <div>
            <div className="text-xs uppercase tracking-wide text-muted-foreground">
              Amount claimed
            </div>
            <div className="font-mono">{fmtMoney(filing.amountClaimedCents)}</div>
          </div>
          <div>
            <div className="text-xs uppercase tracking-wide text-muted-foreground">Court</div>
            <div>{filing.courtDivision ?? <span className="text-muted-foreground">—</span>}</div>
          </div>
          <div>
            <div className="text-xs uppercase tracking-wide text-muted-foreground">Filed</div>
            <div>{fmtDate(filing.filedAt)}</div>
          </div>
          <div className="col-span-2">
            <div className="text-xs uppercase tracking-wide text-muted-foreground">Source</div>
            <div className="font-mono text-xs">{filing.source}</div>
          </div>
        </CardContent>
      </Card>

      <RiskScorePanel filing={filing} score={score} />

      {filing.rawJson != null && (
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <CardTitle className="text-base">Raw source data</CardTitle>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setShowRawJson((v) => !v)}
                aria-expanded={showRawJson}
              >
                {showRawJson ? 'Hide' : 'Show'}
              </Button>
            </div>
          </CardHeader>
          {showRawJson ? (
            <CardContent>
              <pre className="overflow-x-auto rounded bg-muted p-3 text-xs">
                <code>{JSON.stringify(filing.rawJson, null, 2)}</code>
              </pre>
            </CardContent>
          ) : null}
        </Card>
      )}
    </div>
  );
}

function RiskScorePanel({
  filing,
  score,
}: {
  filing: EvictionFiling;
  score: EvictionFilingRiskScore | null;
}) {
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  const onClick = () => {
    setError(null);
    startTransition(async () => {
      const result = await scoreFilingAction(filing.id);
      if (!result.ok) setError(result.error);
    });
  };

  if (!score) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Risk score</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3 text-sm">
          <p className="text-muted-foreground">
            This case has not been scored yet. Scoring uses Claude to assess displacement risk from
            public filing facts only — no PHI.
          </p>
          <div className="flex items-center gap-3">
            <Button onClick={onClick} disabled={pending} size="sm">
              {pending ? 'Scoring…' : 'Score this case'}
            </Button>
            {error ? <span className="text-destructive text-xs">{error}</span> : null}
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">Risk score</CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        <div className="flex items-baseline gap-3">
          <span className={`text-5xl font-semibold tabular-nums ${riskBandClass(score.score)}`}>
            {score.score}
          </span>
          <span className={`text-sm font-medium ${riskBandClass(score.score)}`}>
            {riskBandLabel(score.score)}
          </span>
        </div>
        <p className="text-sm leading-relaxed">{score.rationale}</p>
        <div className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-muted-foreground">
          <span>
            Model: <span className="font-mono">{score.modelVersion}</span>
          </span>
          <span>Scored {fmtDate(score.createdAt)}</span>
        </div>
      </CardContent>
    </Card>
  );
}
