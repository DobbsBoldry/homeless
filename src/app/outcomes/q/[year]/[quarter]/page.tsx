import { auth } from '@clerk/nextjs/server';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { PrintButton } from '@/components/coordination/print-button';
import { QuarterlyNarrativePanel } from '@/components/operations/quarterly-narrative-panel';
import { Card, CardContent } from '@/components/ui/card';
import {
  getCoalitionAggregate,
  getGovernanceCountsForQuarter,
  listQuarterlyEvictionAggregates,
  type Quarter,
} from '@/db/queries/public-outcomes';
import { renderTransparencyReport } from '@/lib/dtrs/transparency-report';

export const dynamic = 'force-dynamic';

const fmt = (n: number | null) =>
  n === null ? <span className="text-muted-foreground">— suppressed</span> : n.toLocaleString();

const fmtPct = (a: number | null, b: number | null) =>
  a === null || b === null || b === 0 ? '—' : `${Math.round((a / b) * 100)}%`;

function parseQuarter(yearRaw: string, quarterRaw: string): Quarter | null {
  const year = Number.parseInt(yearRaw, 10);
  const quarterNum = Number.parseInt(quarterRaw.replace(/^q/i, ''), 10);
  if (!Number.isInteger(year) || year < 2024 || year > 2100) return null;
  if (![1, 2, 3, 4].includes(quarterNum)) return null;
  return { year, quarter: quarterNum as 1 | 2 | 3 | 4, label: `${year} Q${quarterNum}` };
}

export const metadata = {
  title: 'Quarterly transparency report — Daviess Coalition',
};

export default async function QuarterlyReportPage({
  params,
}: {
  params: Promise<{ year: string; quarter: string }>;
}) {
  const { year, quarter: q } = await params;
  const quarter = parseQuarter(year, q);
  if (!quarter) notFound();

  const [eviction, coalitionSnapshot, governanceForQuarter, session] = await Promise.all([
    listQuarterlyEvictionAggregates([quarter]),
    getCoalitionAggregate(90),
    getGovernanceCountsForQuarter(quarter),
    auth(),
  ]);
  const evictionForQuarter = eviction[0];
  const generatedAt = new Date();
  const signedIn = Boolean(session.userId);

  const repRate = fmtPct(evictionForQuarter.filingsWithPacket, evictionForQuarter.filingsIngested);

  // The Markdown report is the canonical form — staff copy/paste it
  // into newsletters, funder updates, etc. Surface it as a "view raw"
  // link below the rendered HTML version.
  const markdown = renderTransparencyReport({
    quarter,
    evictionForQuarter,
    coalitionSnapshot,
    governanceForQuarter,
    generatedAt,
  });

  return (
    <main className="mx-auto max-w-3xl space-y-6 p-6 md:p-8 print:max-w-none print:p-0">
      <div className="text-xs print:hidden">
        <Link href="/outcomes" className="text-muted-foreground hover:underline">
          ← Back to outcomes
        </Link>
      </div>

      <header className="space-y-2">
        <p className="text-xs uppercase tracking-wide text-muted-foreground">
          Daviess County Homelessness-Response Coalition
        </p>
        <h1 className="font-serif text-4xl font-bold text-primary">
          {quarter.label} Transparency Report
        </h1>
        <p className="text-sm text-muted-foreground">
          Generated {generatedAt.toISOString().slice(0, 10)} from live coalition data. Aggregate-
          only; cells with fewer than 5 subjects are suppressed.
        </p>
      </header>

      <section className="space-y-3">
        <h2 className="font-serif text-2xl font-semibold">Coalition snapshot</h2>
        <ul className="grid gap-2 text-sm md:grid-cols-2">
          <li>
            <strong>{coalitionSnapshot.partnerCount}</strong> partner organizations active
          </li>
          <li>
            <strong>{coalitionSnapshot.partnersSharing}</strong> partners actively sharing data
          </li>
          <li>
            <strong>{coalitionSnapshot.shelterCount}</strong> shelters listed
          </li>
          <li>
            <strong>{coalitionSnapshot.totalShelterCapacity}</strong> coalition-wide beds
          </li>
          <li>
            Service events (rolling {coalitionSnapshot.rollingWindowDays}d):{' '}
            <strong>{fmt(coalitionSnapshot.serviceEventsRolling)}</strong>
          </li>
          <li>
            Distinct people (rolling): <strong>{fmt(coalitionSnapshot.uniquePeopleRolling)}</strong>
          </li>
        </ul>
      </section>

      <section className="space-y-3">
        <h2 className="font-serif text-2xl font-semibold">Eviction defense</h2>
        <table className="w-full text-sm">
          <tbody>
            <tr className="border-b border-border">
              <td className="py-2 text-muted-foreground">Filings ingested</td>
              <td className="py-2 text-right">{fmt(evictionForQuarter.filingsIngested)}</td>
            </tr>
            <tr className="border-b border-border">
              <td className="py-2 text-muted-foreground">Filings with response packet</td>
              <td className="py-2 text-right">{fmt(evictionForQuarter.filingsWithPacket)}</td>
            </tr>
            <tr className="border-b border-border">
              <td className="py-2 text-muted-foreground">Representation rate</td>
              <td className="py-2 text-right">{repRate}</td>
            </tr>
            <tr className="border-b border-border">
              <td className="py-2 text-muted-foreground">Outcomes recorded</td>
              <td className="py-2 text-right">{fmt(evictionForQuarter.outcomesRecorded)}</td>
            </tr>
            <tr>
              <td className="py-2 text-muted-foreground">Default judgments</td>
              <td className="py-2 text-right">{fmt(evictionForQuarter.defaultJudgments)}</td>
            </tr>
          </tbody>
        </table>
        <p className="text-xs text-muted-foreground">
          Filings are public Daviess District Court records. Response packets are AI-drafted answers
          reviewed by a Kentucky Legal Aid attorney before filing. Default judgments — when a tenant
          doesn't respond at all — are the avoid-this metric.
        </p>
      </section>

      <section className="space-y-3">
        <h2 className="font-serif text-2xl font-semibold">Data trust governance</h2>
        <table className="w-full text-sm">
          <tbody>
            <tr className="border-b border-border">
              <td className="py-2 text-muted-foreground">Consent grants</td>
              <td className="py-2 text-right">{fmt(governanceForQuarter.consentGrants)}</td>
            </tr>
            <tr className="border-b border-border">
              <td className="py-2 text-muted-foreground">Consent revocations</td>
              <td className="py-2 text-right">{fmt(governanceForQuarter.consentRevocations)}</td>
            </tr>
            <tr>
              <td className="py-2 text-muted-foreground">Per-record accesses logged</td>
              <td className="py-2 text-right">{fmt(governanceForQuarter.dataAccessEvents)}</td>
            </tr>
          </tbody>
        </table>
        <p className="text-xs text-muted-foreground">
          Every consent grant + revocation is timestamped. Every per-record access by coalition
          staff lands in an append-only audit trail. Revocations are honored immediately.
        </p>
      </section>

      {signedIn ? (
        <section className="print:hidden">
          <QuarterlyNarrativePanel year={quarter.year} quarter={quarter.quarter} />
        </section>
      ) : null}

      <section className="space-y-3 rounded-md border border-border bg-muted/20 p-4 text-xs print:hidden">
        <h2 className="font-serif text-base font-semibold">Share this report</h2>
        <div className="flex flex-wrap items-center gap-2">
          <PrintButton />
          <Link
            href={`/outcomes/q/${quarter.year}/${quarter.quarter}/markdown`}
            className="rounded-md border border-border bg-card px-3 py-1.5 hover:bg-muted"
          >
            View as Markdown
          </Link>
          <Link
            href={`/outcomes/q/${quarter.year}/${quarter.quarter}/markdown?download=1`}
            className="rounded-md border border-border bg-card px-3 py-1.5 hover:bg-muted"
          >
            Download .md
          </Link>
        </div>
        <p className="text-muted-foreground">
          The Markdown form is the canonical output for newsletters, funder updates, and pastes into
          Notion / Google Docs. It contains the same data shown above with no extra chrome.
        </p>
      </section>

      <Card className="border-amber-500/40 bg-amber-500/5 print:hidden">
        <CardContent className="text-xs text-muted-foreground">
          Built per DTRS-013 in the coalition's engineering backlog. Data is recomputed on every
          page load against the live database — no caching, no stale numbers. The coalition's
          quarterly report cadence is non-binding; this URL works for any quarter that has recorded
          data.
        </CardContent>
      </Card>

      {/* Hidden by default — present so /markdown can fetch the same component if it ever wants. */}
      <noscript style={{ display: 'none' }}>{markdown}</noscript>
    </main>
  );
}
