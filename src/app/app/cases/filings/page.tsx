import { CaseFilingsRoles } from '@/components/eviction/case-filings-roles';
import { FilingsTable } from '@/components/eviction/filings-table';
import { SourceFilter } from '@/components/eviction/source-filter';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { listRecentFilings } from '@/db/queries/eviction-filings';
import type { EvictionFilingSource } from '@/db/schema/enums';
import { requireRole } from '@/lib/auth';

const ALLOWED_SOURCES: EvictionFilingSource[] = ['synthetic', 'manual', 'courtnet'];

export default async function FilingsPage({
  searchParams,
}: {
  searchParams: Promise<{ source?: string }>;
}) {
  await requireRole(CaseFilingsRoles);

  const params = await searchParams;
  const source = ALLOWED_SOURCES.find((s) => s === params.source);
  const filings = await listRecentFilings({ limit: 50, source });

  return (
    <div className="mx-auto max-w-6xl p-6 space-y-4">
      <header>
        <h1 className="font-serif text-3xl font-bold text-primary">Filings</h1>
        <p className="text-sm text-muted-foreground">
          Most recent {filings.length} eviction filings (Daviess District Court).
        </p>
      </header>

      <SourceFilter selected={source} />

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
