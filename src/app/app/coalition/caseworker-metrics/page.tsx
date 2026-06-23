import Link from 'next/link';
import { TimeSavedChart } from '@/components/cwt/time-saved-chart';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import {
  getCaseworkerTimeSavedMetrics,
  TIME_SAVED_TREND_WEEKS,
} from '@/db/queries/caseworker-metrics';
import { requireRole } from '@/lib/auth';

export const dynamic = 'force-dynamic';

const fmtMinutes = (v: number | null): string => {
  if (v == null) return '—';
  if (v >= 60) {
    const h = Math.floor(v / 60);
    const m = Math.round(v % 60);
    return m === 0 ? `${h}h` : `${h}h ${m}m`;
  }
  return `${Math.round(v)}m`;
};

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

export default async function CaseworkerMetricsPage() {
  // CWT-026: admin / coalition-leadership only. No caseworker-facing display.
  await requireRole(['admin']);

  const metrics = await getCaseworkerTimeSavedMetrics();
  const hasData = metrics.totalCasesMeasured > 0;

  return (
    <div className="mx-auto max-w-6xl space-y-4 p-6">
      <div className="text-xs">
        <Link href="/app/coalition" className="text-muted-foreground hover:underline">
          ← Back to coalition
        </Link>
      </div>

      <header>
        <h1 className="font-serif text-3xl font-bold text-primary">Caseworker time-saved</h1>
        <p className="text-sm text-muted-foreground">
          Time from case-open to first AI-drafted case note — the adoption KPI for AI drafting
          (CWT-026). Coalition aggregate; not a per-caseworker performance dashboard.
        </p>
      </header>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        <Kpi
          label="Avg time-to-draft (all time)"
          value={fmtMinutes(metrics.overallAvgMinutesToDraft)}
          hint="Case-open → first AI draft"
        />
        <Kpi
          label="Cases measured"
          value={metrics.totalCasesMeasured.toLocaleString()}
          hint="Cases with at least one AI draft"
        />
        <Kpi
          label="Active caseworkers this week"
          value={metrics.currentWeekRows.length.toLocaleString()}
          hint={`Week of ${metrics.currentWeekStart}`}
        />
      </div>

      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-base">
            Weekly trend · last {TIME_SAVED_TREND_WEEKS} weeks
          </CardTitle>
        </CardHeader>
        <CardContent>
          {hasData ? (
            <TimeSavedChart data={metrics.weeklyTrend} />
          ) : (
            <p className="py-12 text-center text-sm text-muted-foreground">
              No AI-drafted case notes yet — the trend appears once drafting begins.
            </p>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-base">
            This week by caseworker · week of {metrics.currentWeekStart}
          </CardTitle>
        </CardHeader>
        <CardContent>
          {metrics.currentWeekRows.length > 0 ? (
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b text-left text-xs uppercase tracking-wide text-muted-foreground">
                  <th className="py-2 pr-4 font-medium">Caseworker</th>
                  <th className="py-2 pr-4 text-right font-medium">Cases this week</th>
                  <th className="py-2 text-right font-medium">Avg time-to-draft</th>
                </tr>
              </thead>
              <tbody>
                {metrics.currentWeekRows.map((row) => (
                  <tr key={row.caseworkerId} className="border-b last:border-0">
                    <td className="py-2 pr-4">{row.caseworkerName}</td>
                    <td className="py-2 pr-4 text-right font-mono tabular-nums">{row.caseCount}</td>
                    <td className="py-2 text-right font-mono tabular-nums">
                      {fmtMinutes(row.avgMinutesToDraft)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          ) : (
            <p className="py-8 text-center text-sm text-muted-foreground">
              No AI drafts recorded this week yet.
            </p>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
