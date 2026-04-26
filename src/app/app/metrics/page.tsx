import Link from 'next/link';
import { DailyChart } from '@/components/metrics/daily-chart';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import {
  type DailyPoint,
  getDailySeries,
  getMetricsKpis,
  getMetricsRates,
  type MetricsKpis,
  type MetricsRates,
} from '@/db/queries/metrics';
import { requireRole } from '@/lib/auth';

const WINDOW_DAYS = 30;

const fmtPct = (v: number | null): string => (v == null ? '—' : `${(v * 100).toFixed(0)}%`);
const fmtInt = (v: number): string => v.toLocaleString();

function Kpi({ label, value, hint }: { label: string; value: string; hint?: string }) {
  return (
    <Card>
      <CardHeader className="pb-2">
        <p className="text-xs uppercase tracking-wide text-muted-foreground">{label}</p>
      </CardHeader>
      <CardContent>
        <p className="font-mono text-3xl font-semibold tabular-nums">{value}</p>
        {hint ? <p className="mt-1 text-xs text-muted-foreground">{hint}</p> : null}
      </CardContent>
    </Card>
  );
}

export default async function MetricsPage() {
  await requireRole(['attorney', 'admin']);

  const [kpis, rates, series] = (await Promise.all([
    getMetricsKpis(WINDOW_DAYS),
    getMetricsRates(WINDOW_DAYS),
    getDailySeries(WINDOW_DAYS),
  ])) as [MetricsKpis, MetricsRates, DailyPoint[]];

  const noOutcomes = kpis.outcomesRecorded === 0;

  return (
    <div className="mx-auto max-w-6xl space-y-4 p-6">
      <header>
        <h1 className="font-serif text-3xl font-bold text-primary">Outcomes</h1>
        <p className="text-sm text-muted-foreground">
          Eviction-defense metrics for the last {WINDOW_DAYS} days. Phase 1 cohort: KLA Owensboro.
        </p>
      </header>

      <section className="grid grid-cols-2 gap-3 md:grid-cols-5">
        <Kpi
          label={`Filings (${WINDOW_DAYS}d)`}
          value={fmtInt(kpis.filingsInWindow)}
          hint="Ingested by the daily docket job"
        />
        <Kpi
          label="With packet"
          value={fmtInt(kpis.filingsWithPacket)}
          hint="Filings with at least one AI-drafted answer"
        />
        <Kpi label="Packets approved" value={fmtInt(kpis.packetsApproved)} hint="Awaiting filing" />
        <Kpi label="Packets filed" value={fmtInt(kpis.packetsFiled)} hint="Submitted to court" />
        <Kpi label="Outcomes" value={fmtInt(kpis.outcomesRecorded)} hint="Court results recorded" />
      </section>

      <section className="grid grid-cols-1 gap-3 md:grid-cols-3">
        <Kpi
          label="Representation rate"
          value={fmtPct(rates.representationRate)}
          hint="Filings with at least one packet generated"
        />
        <Kpi
          label="Default-judgment rate"
          value={fmtPct(rates.defaultJudgmentRate)}
          hint="Of cases with any recorded outcome"
        />
        <Kpi
          label="Favorable outcomes"
          value={fmtPct(rates.favorableOutcomeRate)}
          hint="Dismissed, defendant judgment, or settled"
        />
      </section>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">
            Daily filings vs. packets approved (last {WINDOW_DAYS} days)
          </CardTitle>
        </CardHeader>
        <CardContent>
          <DailyChart data={series} />
        </CardContent>
      </Card>

      {noOutcomes ? (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">No outcomes recorded yet</CardTitle>
          </CardHeader>
          <CardContent className="text-sm text-muted-foreground">
            Outcomes (dismissed, judgment, settled, default) are recorded from the case-detail page
            once the court rules. Open a case from the{' '}
            <Link href="/app/cases/queue" className="underline hover:text-primary">
              daily queue
            </Link>{' '}
            and use the &ldquo;Record outcome&rdquo; form to start populating this dashboard.
          </CardContent>
        </Card>
      ) : null}
    </div>
  );
}
