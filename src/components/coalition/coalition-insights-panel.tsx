'use client';

import { useState, useTransition } from 'react';
import {
  type CoalitionInsightsResult,
  generateCoalitionInsightsAction,
} from '@/app/actions/coalition-insights';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';

const fmtDate = (d: Date) =>
  new Intl.DateTimeFormat('en-US', { dateStyle: 'medium' }).format(new Date(d));

type SuccessResult = Extract<CoalitionInsightsResult, { ok: true }>;

const WINDOW_OPTIONS = [
  { label: 'Last 7 days', days: 7 },
  { label: 'Last 14 days', days: 14 },
  { label: 'Last 30 days', days: 30 },
];

export function CoalitionInsightsPanel() {
  const [windowDays, setWindowDays] = useState(7);
  const [data, setData] = useState<SuccessResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  const onClick = () => {
    setError(null);
    startTransition(async () => {
      const r = await generateCoalitionInsightsAction(windowDays);
      if (!r.ok) {
        setError(r.error);
        return;
      }
      setData(r);
    });
  };

  return (
    <Card>
      <CardHeader className="flex flex-row items-baseline justify-between gap-2">
        <CardTitle className="text-base">Weekly insights</CardTitle>
        <div className="flex items-center gap-2">
          {WINDOW_OPTIONS.map((w) => (
            <Button
              key={w.days}
              type="button"
              variant={windowDays === w.days ? 'default' : 'outline'}
              size="sm"
              disabled={pending}
              onClick={() => setWindowDays(w.days)}
              className="text-xs"
            >
              {w.label}
            </Button>
          ))}
        </div>
      </CardHeader>
      <CardContent className="space-y-4 text-sm">
        {!data ? (
          <>
            <p className="text-muted-foreground">
              Claude reads the aggregate counts (filings, intakes, service events, consents) plus
              the action-blocked queues (urgent intakes, high-risk filings without packets) and
              writes a 3-paragraph brief: pulse, patterns, what to ask in the next steering meeting.
            </p>
            <div className="flex items-center gap-3">
              <Button onClick={onClick} disabled={pending} size="sm">
                {pending ? 'Reading the coalition…' : 'Run weekly insights'}
              </Button>
              {error ? <span className="text-xs text-destructive">{error}</span> : null}
            </div>
          </>
        ) : (
          <>
            <p className="whitespace-pre-wrap leading-relaxed">{data.text}</p>

            <div className="rounded-md border border-border bg-muted/30 p-3 text-xs">
              <p className="mb-2 font-medium">By the numbers</p>
              <div className="grid grid-cols-2 gap-x-4 gap-y-1 md:grid-cols-3">
                <Stat label="New filings" value={data.digest.newFilings} />
                <Stat label="New intakes" value={data.digest.newIntakes} />
                <Stat label="Service events" value={data.digest.newServiceEvents} />
                <Stat label="Consent grants" value={data.digest.newConsentGrants} />
                <Stat label="Consent revocations" value={data.digest.newConsentRevocations} />
                <Stat label="Urgent intakes" value={data.digest.urgentExtractedIntakes} />
                <Stat label="High-risk no-packet" value={data.digest.highScoreFilingsNoPacket} />
                <Stat label="Cross-org touches" value={data.digest.crossOrgTouchpoints.length} />
              </div>
            </div>

            <div className="flex flex-wrap items-center justify-between gap-3 text-[11px] text-muted-foreground">
              <span>
                Window: since {fmtDate(new Date(data.digest.since))} · Model:{' '}
                <span className="font-mono">{data.modelId}</span> · Prompt:{' '}
                <span className="font-mono">{data.promptVersion}</span>
              </span>
              <Button onClick={onClick} disabled={pending} size="sm" variant="outline">
                {pending ? 'Re-running…' : 'Re-run'}
              </Button>
            </div>
          </>
        )}
      </CardContent>
    </Card>
  );
}

function Stat({ label, value }: { label: string; value: number }) {
  return (
    <div className="flex items-baseline gap-2">
      <span className="font-mono text-sm font-medium tabular-nums">{value}</span>
      <span className="text-xs text-muted-foreground">{label}</span>
    </div>
  );
}
