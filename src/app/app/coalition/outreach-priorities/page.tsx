import Link from 'next/link';
import { listOutreachPriorities } from '@/db/queries/outreach-priorities';
import { requireRole } from '@/lib/auth';
import { DEFAULT_OUTREACH_MIN_CELL_SIZE } from '@/lib/oprt';

export const dynamic = 'force-dynamic';

const WINDOW_DAYS = 30;

export default async function OutreachPrioritiesPage() {
  await requireRole(['admin', 'caseworker']);

  const result = await listOutreachPriorities({ windowDays: WINDOW_DAYS });
  const reportableTotal = result.priorities.reduce((s, p) => s + p.count, 0);

  return (
    <div className="mx-auto max-w-3xl space-y-6 p-4 md:p-6">
      <div className="text-xs">
        <Link href="/app/coalition" className="text-muted-foreground hover:underline">
          ← Back to coalition
        </Link>
      </div>
      <header>
        <h1 className="font-serif text-3xl font-bold text-primary">
          Outreach pre-positioning priorities
        </h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Eviction-filing aggregate by ZIP for the last {WINDOW_DAYS} days. Mobile outreach teams
          (Catholic Charities and other faith partners) use this to pre-position visits ahead of the
          post-filing window. Aggregate-only — see{' '}
          <Link
            href="/agreements/faith-aggregate"
            className="underline underline-offset-2 hover:text-foreground"
          >
            ADR 0003
          </Link>
          . Cell-size suppression at {DEFAULT_OUTREACH_MIN_CELL_SIZE} filings per ZIP.
        </p>
      </header>

      <section className="grid gap-3 sm:grid-cols-3">
        <div className="rounded-md border border-border bg-muted/10 p-3 text-sm">
          <p className="text-xs text-muted-foreground">Filings considered</p>
          <p className="text-2xl font-semibold tabular-nums">{result.totalFilings}</p>
        </div>
        <div className="rounded-md border border-border bg-muted/10 p-3 text-sm">
          <p className="text-xs text-muted-foreground">Reportable</p>
          <p className="text-2xl font-semibold tabular-nums">{reportableTotal}</p>
          <p className="text-[10px] text-muted-foreground">
            {result.priorities.length} ZIP{result.priorities.length === 1 ? '' : 's'} above
            threshold
          </p>
        </div>
        <div className="rounded-md border border-border bg-muted/10 p-3 text-sm">
          <p className="text-xs text-muted-foreground">Suppressed</p>
          <p className="text-2xl font-semibold tabular-nums">{result.suppressedCount}</p>
          <p className="text-[10px] text-muted-foreground">
            {result.suppressedRegions} ZIP{result.suppressedRegions === 1 ? '' : 's'} below
            threshold
          </p>
        </div>
      </section>

      {result.priorities.length === 0 ? (
        <div className="rounded-md border border-border bg-muted/20 p-6 text-sm">
          <p className="font-semibold">No reportable ZIPs in the last {WINDOW_DAYS} days.</p>
          <p className="mt-2 text-muted-foreground">
            Either filing volume is below the cell-size threshold across the board, or the synthetic
            seed hasn't loaded recent filings. Run{' '}
            <code className="font-mono">pnpm tsx scripts/load-fixtures.ts</code> to refresh.
          </p>
        </div>
      ) : (
        <div className="overflow-x-auto rounded-md border border-border">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b bg-muted/30 text-left">
                <th className="px-3 py-2 font-medium">Rank</th>
                <th className="px-3 py-2 font-medium">ZIP</th>
                <th className="px-3 py-2 font-medium">Filings</th>
                <th className="px-3 py-2 font-medium">Share of reportable</th>
              </tr>
            </thead>
            <tbody>
              {result.priorities.map((p, idx) => {
                const pct =
                  reportableTotal === 0 ? 0 : Math.round((p.count / reportableTotal) * 100);
                return (
                  <tr key={p.zip} className="border-b last:border-0 hover:bg-muted/10">
                    <td className="px-3 py-2 tabular-nums">#{idx + 1}</td>
                    <td className="px-3 py-2 font-mono">{p.zip}</td>
                    <td className="px-3 py-2 tabular-nums">{p.count}</td>
                    <td className="px-3 py-2 tabular-nums text-muted-foreground">{pct}%</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      {result.unknownZipCount > 0 && (
        <div className="rounded-md border border-amber-500/40 bg-amber-500/5 p-3 text-xs">
          <p className="font-medium">Data quality note</p>
          <p className="mt-1 text-muted-foreground">
            {result.unknownZipCount} filing{result.unknownZipCount === 1 ? '' : 's'} could not be
            resolved to a ZIP from the address text. These are not included in the priority ranking
            but flag a parser gap worth investigating in the courtnet ingest pipeline.
          </p>
        </div>
      )}

      <div className="rounded-md border border-border bg-muted/10 p-3 text-xs">
        <p className="font-medium">What this view is — and isn't</p>
        <ul className="mt-1 list-disc pl-5 space-y-1 text-muted-foreground">
          <li>Public eviction filings only. No ED, no school-referral, no SMS data.</li>
          <li>Defendant names are not surfaced here; the query selects only address + filed-at.</li>
          <li>
            Cell-size suppression at {DEFAULT_OUTREACH_MIN_CELL_SIZE} mirrors the faith-aggregate
            privacy contract (ADR 0003) — small ZIPs disappear so individuals can't be inferred.
          </li>
          <li>
            Outreach decisions are downstream — this view ranks where to *consider* visiting, not
            who.
          </li>
        </ul>
      </div>
    </div>
  );
}
