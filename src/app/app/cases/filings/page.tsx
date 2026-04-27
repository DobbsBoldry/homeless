import Link from 'next/link';
import { CaseFilingsRoles } from '@/components/eviction/case-filings-roles';
import { FilingsTable } from '@/components/eviction/filings-table';
import { PlaintiffPatternsCard } from '@/components/eviction/plaintiff-patterns-card';
import { SourceFilter } from '@/components/eviction/source-filter';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { listRecentFilingsForViewer, listTopPlaintiffsRecent } from '@/db/queries/eviction-filings';
import type { EvictionFilingSource } from '@/db/schema/enums';
import { requireRole, userIsKlaAttorney } from '@/lib/auth';

const PATTERN_WINDOW_DAYS = 30;
const PATTERN_MIN_COUNT = 3;

const ALLOWED_SOURCES: EvictionFilingSource[] = ['synthetic', 'manual', 'courtnet'];

export default async function FilingsPage({
  searchParams,
}: {
  searchParams: Promise<{ source?: string }>;
}) {
  const me = await requireRole(CaseFilingsRoles);

  const params = await searchParams;
  const source = ALLOWED_SOURCES.find((s) => s === params.source);
  const [filings, canTriage, topPlaintiffs] = await Promise.all([
    listRecentFilingsForViewer({ limit: 50, source }, me.role),
    userIsKlaAttorney(me),
    listTopPlaintiffsRecent({
      windowDays: PATTERN_WINDOW_DAYS,
      minCount: PATTERN_MIN_COUNT,
      limit: 10,
    }),
  ]);

  return (
    <div className="mx-auto max-w-6xl p-6 space-y-4">
      <header className="flex flex-wrap items-baseline justify-between gap-3">
        <div>
          <h1 className="font-serif text-3xl font-bold text-primary">Filings</h1>
          <p className="text-sm text-muted-foreground">
            Most recent {filings.length} eviction filings (Daviess District Court).
          </p>
        </div>
        {canTriage ? (
          <Link
            href="/app/cases/triage"
            className="shrink-0 rounded-md bg-primary px-3 py-2 text-xs font-medium text-primary-foreground hover:bg-primary/90"
          >
            Morning triage →
          </Link>
        ) : null}
      </header>

      <SourceFilter selected={source} />

      {topPlaintiffs.length > 0 ? (
        <PlaintiffPatternsCard
          initialPlaintiffs={topPlaintiffs}
          windowDays={PATTERN_WINDOW_DAYS}
          minCount={PATTERN_MIN_COUNT}
        />
      ) : null}

      {filings.length === 0 ? (
        <Card>
          <CardHeader>
            <CardTitle>No filings yet</CardTitle>
            <CardDescription>
              The eviction_filings table is empty. To seed synthetic test data:
            </CardDescription>
          </CardHeader>
          <CardContent>
            <pre className="overflow-x-auto rounded-md bg-muted p-3 text-xs">
              <code>pnpm tsx scripts/load-fixtures.ts</code>
            </pre>
            <p className="mt-2 text-xs text-muted-foreground">
              Production CourtNet data lands once EVDT-001/002 spikes resolve and EVDT-005 ships the
              daily scraper.
            </p>
          </CardContent>
        </Card>
      ) : (
        <FilingsTable filings={filings} />
      )}
    </div>
  );
}
