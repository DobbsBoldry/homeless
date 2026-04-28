import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import {
  getCoalitionTotalsForPeriod,
  listMinistryInsightRows,
  listSubmissionsAcrossMinistries,
} from '@/db/queries/faith-aggregate';
import { requireRole } from '@/lib/auth';

export const dynamic = 'force-dynamic';

const WINDOW_DAYS = 28;

function trailing28Days(): { since: Date; until: Date } {
  const until = new Date();
  const since = new Date();
  since.setUTCDate(since.getUTCDate() - WINDOW_DAYS);
  since.setUTCHours(0, 0, 0, 0);
  return { since, until };
}

const fmtDate = (s: string | null) =>
  s ? new Intl.DateTimeFormat('en-US').format(new Date(s)) : '—';

const fmtTs = (d: Date) =>
  new Intl.DateTimeFormat('en-US', { dateStyle: 'short', timeStyle: 'short' }).format(new Date(d));

function labelMetricKey(key: string): string {
  return key.replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase());
}

export default async function FaithAggregateInsightsPage() {
  await requireRole(['admin']);

  const { since, until } = trailing28Days();

  const [coalitionTotals, ministryRows, recentSubmissions] = await Promise.all([
    getCoalitionTotalsForPeriod(since, until),
    listMinistryInsightRows({ since }),
    listSubmissionsAcrossMinistries({ since, limit: 25 }),
  ]);

  const activeCoalitionTotals = coalitionTotals.filter((t) => t.reportingMinistries > 0);
  const VISIBLE_LIMIT = 25;
  const overLimit = recentSubmissions.length === VISIBLE_LIMIT;

  return (
    <div className="mx-auto max-w-6xl space-y-6 p-4 md:p-6">
      <header>
        <h1 className="font-serif text-3xl font-bold text-primary">Faith-aggregate insights</h1>
        <p className="text-sm text-muted-foreground">
          Coalition-level demand picture — trailing {WINDOW_DAYS} days. Suppressed cells (below
          ministry k-anonymity threshold) are excluded from totals and counted separately.
        </p>
      </header>

      {/* ------------------------------------------------------------------ */}
      {/* Coalition totals card                                               */}
      {/* ------------------------------------------------------------------ */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Coalition totals — last {WINDOW_DAYS} days</CardTitle>
        </CardHeader>
        <CardContent>
          {activeCoalitionTotals.length === 0 ? (
            <p className="text-sm text-muted-foreground">No reporting in window.</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b text-xs uppercase tracking-wide text-muted-foreground">
                    <th className="py-2 text-left">Metric</th>
                    <th className="py-2 text-right">Total</th>
                    <th className="py-2 text-right">Ministries reporting</th>
                    <th className="py-2 text-right">Ministries suppressed</th>
                  </tr>
                </thead>
                <tbody>
                  {activeCoalitionTotals.map((row) => (
                    <tr key={row.metricKey} className="border-b last:border-0">
                      <td className="py-2 font-medium">{labelMetricKey(row.metricKey)}</td>
                      <td className="py-2 text-right tabular-nums">
                        {row.totalValue.toLocaleString()}
                      </td>
                      <td className="py-2 text-right tabular-nums">{row.reportingMinistries}</td>
                      <td className="py-2 text-right tabular-nums text-muted-foreground">
                        {row.suppressedMinistries > 0 ? (
                          <span title="Cells below this ministry's k-anonymity threshold are excluded from totals">
                            {row.suppressedMinistries}
                          </span>
                        ) : (
                          '—'
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>

      {/* ------------------------------------------------------------------ */}
      {/* Per-ministry table                                                  */}
      {/* ------------------------------------------------------------------ */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">
            Per-ministry summary — last {WINDOW_DAYS} days
          </CardTitle>
        </CardHeader>
        <CardContent>
          {ministryRows.length === 0 ? (
            <p className="text-sm text-muted-foreground">No opted-in ministries.</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b text-xs uppercase tracking-wide text-muted-foreground">
                    <th className="py-2 text-left">Ministry</th>
                    <th className="py-2 text-right">Submissions</th>
                    <th className="py-2 text-right">Last period end</th>
                    <th className="py-2 text-right">Suppressed cells</th>
                  </tr>
                </thead>
                <tbody>
                  {ministryRows.map((row) => (
                    <tr key={row.id} className="border-b last:border-0">
                      <td className="py-2 font-medium">{row.name}</td>
                      <td className="py-2 text-right tabular-nums">{row.submissionCount}</td>
                      <td className="py-2 text-right text-muted-foreground">
                        {fmtDate(row.lastPeriodEnd)}
                      </td>
                      <td className="py-2 text-right tabular-nums text-muted-foreground">
                        {row.suppressedCellCount > 0 ? (
                          <span
                            className="text-amber-600"
                            title="Metric cells suppressed due to k-anonymity threshold"
                          >
                            {row.suppressedCellCount}
                          </span>
                        ) : (
                          '—'
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>

      {/* ------------------------------------------------------------------ */}
      {/* Recent submissions list                                             */}
      {/* ------------------------------------------------------------------ */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">
            Recent submissions
            {overLimit ? ` (showing ${VISIBLE_LIMIT} most recent)` : ''}
          </CardTitle>
        </CardHeader>
        <CardContent>
          {recentSubmissions.length === 0 ? (
            <p className="text-sm text-muted-foreground">
              No submissions in the last {WINDOW_DAYS} days.
            </p>
          ) : (
            <ul className="space-y-1 text-sm">
              {recentSubmissions.map((sub) => (
                <li
                  key={sub.id}
                  className="flex flex-wrap items-baseline justify-between gap-2 rounded bg-muted/40 px-3 py-2"
                >
                  <span className="font-medium">{sub.ministryName}</span>
                  <span className="text-muted-foreground">
                    {fmtDate(sub.periodStart)}
                    {' – '}
                    {fmtDate(sub.periodEnd)}
                  </span>
                  <span className="text-muted-foreground">Submitted {fmtTs(sub.submittedAt)}</span>
                  {sub.suppressedMetricCount > 0 ? (
                    <span
                      className="text-xs text-amber-600"
                      title="Number of metric cells excluded from totals (below k-anonymity threshold)"
                    >
                      {sub.suppressedMetricCount} suppressed
                    </span>
                  ) : null}
                </li>
              ))}
            </ul>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
