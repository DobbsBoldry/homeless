import Link from 'next/link';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import {
  getCoalitionAggregate,
  getGovernanceCounts,
  listLastNQuarters,
  listQuarterlyEvictionAggregates,
} from '@/db/queries/public-outcomes';

export const dynamic = 'force-dynamic';

export const metadata = {
  title: 'Outcomes — Daviess Coalition',
  description:
    'Public outcome dashboard for the Daviess County homelessness-response coalition. Quarterly aggregate counts only — no individual data.',
};

const fmt = (n: number | null) =>
  n === null ? <span className="text-muted-foreground">— suppressed</span> : n.toLocaleString();

export default async function PublicOutcomesPage() {
  const quarters = listLastNQuarters(new Date(), 4);
  const [eviction, coalition, governance] = await Promise.all([
    listQuarterlyEvictionAggregates(quarters),
    getCoalitionAggregate(90),
    getGovernanceCounts(),
  ]);

  return (
    <main className="mx-auto max-w-5xl space-y-6 p-6 md:p-8">
      <header className="space-y-2">
        <p className="text-xs uppercase tracking-wide text-muted-foreground">
          Daviess County Homelessness-Response Coalition
        </p>
        <h1 className="font-serif text-4xl font-bold text-primary">Outcomes</h1>
        <p className="text-sm text-muted-foreground">
          Quarterly aggregate counts of what the coalition has done. No individual data; cells with
          fewer than five people are suppressed so no number traces back to a small handful of
          identifiable people.
        </p>
      </header>

      <section className="space-y-3">
        <h2 className="font-serif text-2xl font-semibold">Coalition at a glance</h2>
        <div className="grid gap-3 md:grid-cols-3">
          <Card>
            <CardContent>
              <p className="text-xs uppercase tracking-wide text-muted-foreground">
                Partner organizations
              </p>
              <p className="text-3xl font-semibold">{coalition.partnerCount}</p>
              <p className="text-xs text-muted-foreground">
                {coalition.partnersSharing} actively sharing data
              </p>
            </CardContent>
          </Card>
          <Card>
            <CardContent>
              <p className="text-xs uppercase tracking-wide text-muted-foreground">
                Shelter capacity (coalition)
              </p>
              <p className="text-3xl font-semibold">{coalition.totalShelterCapacity}</p>
              <p className="text-xs text-muted-foreground">
                across {coalition.shelterCount} shelters
              </p>
            </CardContent>
          </Card>
          <Card>
            <CardContent>
              <p className="text-xs uppercase tracking-wide text-muted-foreground">
                Service events (last {coalition.rollingWindowDays} days)
              </p>
              <p className="text-3xl font-semibold">{fmt(coalition.serviceEventsRolling)}</p>
              <p className="text-xs text-muted-foreground">
                across {fmt(coalition.uniquePeopleRolling)} people
              </p>
            </CardContent>
          </Card>
        </div>
      </section>

      <section className="space-y-3">
        <h2 className="font-serif text-2xl font-semibold">Eviction defense by quarter</h2>
        <div className="overflow-x-auto rounded-md border border-border">
          <table className="w-full text-sm">
            <thead className="bg-muted/40 text-left text-xs uppercase tracking-wide text-muted-foreground">
              <tr>
                <th scope="col" className="px-3 py-2">
                  Quarter
                </th>
                <th scope="col" className="px-3 py-2 text-right">
                  Filings
                </th>
                <th scope="col" className="px-3 py-2 text-right">
                  Response packets
                </th>
                <th scope="col" className="px-3 py-2 text-right">
                  Outcomes
                </th>
                <th scope="col" className="px-3 py-2 text-right">
                  Default judgments
                </th>
                <th scope="col" className="px-3 py-2 text-right">
                  Report
                </th>
              </tr>
            </thead>
            <tbody>
              {eviction.map((e) => (
                <tr key={e.quarter.label} className="border-t border-border">
                  <td className="px-3 py-2 font-mono text-xs">{e.quarter.label}</td>
                  <td className="px-3 py-2 text-right">{fmt(e.filingsIngested)}</td>
                  <td className="px-3 py-2 text-right">{fmt(e.filingsWithPacket)}</td>
                  <td className="px-3 py-2 text-right">{fmt(e.outcomesRecorded)}</td>
                  <td className="px-3 py-2 text-right">{fmt(e.defaultJudgments)}</td>
                  <td className="px-3 py-2 text-right">
                    <Link
                      href={`/outcomes/q/${e.quarter.year}/${e.quarter.quarter}`}
                      className="text-xs text-primary hover:underline"
                    >
                      View →
                    </Link>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <p className="text-xs text-muted-foreground">
          Filings are public court records. Response packets and outcomes are coalition-tracked
          aggregates of what happened after legal aid intervention.
        </p>
      </section>

      <section className="space-y-3">
        <h2 className="font-serif text-2xl font-semibold">Data trust governance</h2>
        <div className="grid gap-3 md:grid-cols-3">
          <Card>
            <CardContent>
              <p className="text-xs uppercase tracking-wide text-muted-foreground">
                Consent grants
              </p>
              <p className="text-3xl font-semibold">{fmt(governance.consentGrants90d)}</p>
              <p className="text-xs text-muted-foreground">last 90 days</p>
            </CardContent>
          </Card>
          <Card>
            <CardContent>
              <p className="text-xs uppercase tracking-wide text-muted-foreground">
                Consent revocations
              </p>
              <p className="text-3xl font-semibold">{fmt(governance.consentRevocations90d)}</p>
              <p className="text-xs text-muted-foreground">last 90 days</p>
            </CardContent>
          </Card>
          <Card>
            <CardContent>
              <p className="text-xs uppercase tracking-wide text-muted-foreground">
                Per-record accesses logged
              </p>
              <p className="text-3xl font-semibold">{fmt(governance.dataAccessEvents90d)}</p>
              <p className="text-xs text-muted-foreground">last 90 days, audit-trail</p>
            </CardContent>
          </Card>
        </div>
        <p className="text-xs text-muted-foreground">
          Consent and access counts are part of the coalition's transparency commitment. Every
          record access is logged in an append-only audit trail; revocations are honored
          immediately.
        </p>
      </section>

      <Card className="border-amber-500/40 bg-amber-500/5">
        <CardHeader>
          <CardTitle className="text-base">About this dashboard</CardTitle>
        </CardHeader>
        <CardContent className="space-y-2 text-xs text-muted-foreground">
          <p>
            Built per OPRT-006 in the coalition's engineering backlog. Updated every page load
            against the live database. No personally identifying information is exposed; cells below
            the suppression threshold (5) are shown as <span className="font-mono">—</span>.
          </p>
          <p>
            Source code is open. The data trust governance described above is documented in the
            pilot report; partner organizations participate via signed MOUs.
          </p>
          <p>
            Questions or corrections:{' '}
            <Link href="/" className="underline hover:text-foreground">
              return to the coalition home page
            </Link>{' '}
            for contact info.
          </p>
        </CardContent>
      </Card>
    </main>
  );
}
