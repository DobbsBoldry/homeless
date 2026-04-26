import Link from 'next/link';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { listRecentFilings } from '@/db/queries/eviction-filings';
import { getMetricsKpis, getMetricsRates } from '@/db/queries/metrics';
import { requireRole, userIsKlaAttorney } from '@/lib/auth';

export const dynamic = 'force-dynamic';

const fmtPct = (rate: number | null) => (rate === null ? '—' : `${Math.round(rate * 100)}%`);

export default async function CasesPage() {
  const me = await requireRole(['attorney', 'caseworker', 'admin']);
  const [recent, kpis, rates, isKla] = await Promise.all([
    listRecentFilings({ limit: 5 }),
    getMetricsKpis(30),
    getMetricsRates(30),
    userIsKlaAttorney(me),
  ]);

  return (
    <div className="mx-auto max-w-5xl space-y-4 p-6">
      <header>
        <h1 className="font-serif text-3xl font-bold text-primary">Cases</h1>
        <p className="text-sm text-muted-foreground">
          Eviction-defense triage workspace. Filings come in daily from the Daviess District Court
          docket; the highest-risk cases are flagged for KLA attorney review.
        </p>
      </header>

      <div className="grid gap-4 md:grid-cols-4">
        <Card>
          <CardContent>
            <p className="text-xs uppercase tracking-wide text-muted-foreground">
              Filings (30 days)
            </p>
            <p className="text-3xl font-semibold">{kpis.filingsInWindow}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent>
            <p className="text-xs uppercase tracking-wide text-muted-foreground">
              Representation rate
            </p>
            <p className="text-3xl font-semibold">{fmtPct(rates.representationRate)}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent>
            <p className="text-xs uppercase tracking-wide text-muted-foreground">
              Packets approved
            </p>
            <p className="text-3xl font-semibold">{kpis.packetsApproved}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent>
            <p className="text-xs uppercase tracking-wide text-muted-foreground">
              Outcomes recorded
            </p>
            <p className="text-3xl font-semibold">{kpis.outcomesRecorded}</p>
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-3 md:grid-cols-2">
        {isKla ? (
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Daily queue</CardTitle>
            </CardHeader>
            <CardContent className="space-y-2 text-sm">
              <p className="text-muted-foreground">
                AI-ranked queue of today's filings — highest-risk first, with response packets ready
                to draft.
              </p>
              <Link
                href="/app/cases/queue"
                className="inline-flex h-9 items-center rounded-md bg-primary px-4 text-sm text-primary-foreground hover:bg-primary/90"
              >
                Open queue →
              </Link>
            </CardContent>
          </Card>
        ) : null}

        <Card>
          <CardHeader>
            <CardTitle className="text-base">All filings</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2 text-sm">
            <p className="text-muted-foreground">
              Searchable list of recent filings across all sources (manual, synthetic, CourtNet once
              live).
            </p>
            <Link
              href="/app/cases/filings"
              className="inline-flex h-9 items-center rounded-md border border-input bg-card px-4 text-sm hover:bg-muted"
            >
              Browse filings →
            </Link>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">5 most recent filings</CardTitle>
        </CardHeader>
        <CardContent>
          {recent.length === 0 ? (
            <p className="text-sm text-muted-foreground">
              No filings yet. Run{' '}
              <code className="font-mono">pnpm tsx scripts/load-fixtures.ts</code> to seed synthetic
              data.
            </p>
          ) : (
            <ul className="divide-y divide-border text-sm">
              {recent.map((f) => (
                <li key={f.id} className="flex items-baseline justify-between gap-2 py-2">
                  <Link
                    href={`/app/cases/filings/${f.id}`}
                    className="font-mono text-xs hover:underline"
                  >
                    {f.caseNumber}
                  </Link>
                  <span className="truncate text-muted-foreground">
                    {f.plaintiff} v {f.defendantFirstName.charAt(0)}.{' '}
                    {f.defendantLastName.charAt(0)}.
                  </span>
                  <span className="whitespace-nowrap text-xs text-muted-foreground">
                    {new Date(f.filedAt).toLocaleDateString()}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
