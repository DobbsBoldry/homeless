import Link from 'next/link';
import { DocketFilters, type DocketFilterValues } from '@/components/eviction/docket-filters';
import { DocketTable } from '@/components/eviction/docket-table';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { listRankedDocketForViewer } from '@/db/queries/eviction-filings';
import type { EvictionCauseType, EvictionFilingStatus } from '@/db/schema/enums';
import { requireKlaAttorney } from '@/lib/auth';

const ALLOWED_STATUSES: EvictionFilingStatus[] = [
  'filed',
  'served',
  'judgment',
  'dismissed',
  'sealed',
];
const ALLOWED_CAUSES: EvictionCauseType[] = ['non_payment', 'lease_violation', 'holdover', 'other'];

const parseMinScore = (raw: string | undefined): number | undefined => {
  if (raw === undefined || raw === '') return undefined;
  const n = Number(raw);
  if (!Number.isFinite(n)) return undefined;
  return Math.max(0, Math.min(100, Math.trunc(n)));
};

export default async function DocketQueuePage({
  searchParams,
}: {
  searchParams: Promise<{
    search?: string;
    status?: string;
    cause?: string;
    min_score?: string;
  }>;
}) {
  const me = await requireKlaAttorney();

  const params = await searchParams;
  const status = ALLOWED_STATUSES.find((s) => s === params.status);
  const cause = ALLOWED_CAUSES.find((c) => c === params.cause);
  const minScore = parseMinScore(params.min_score);
  const search = params.search?.trim() || undefined;

  const values: DocketFilterValues = { search, status, cause, minScore };
  const filtersActive = Boolean(search || status || cause || typeof minScore === 'number');

  const rows = await listRankedDocketForViewer(
    { limit: 50, status, cause, minScore, search },
    me.role,
  );

  return (
    <div className="mx-auto max-w-6xl p-6 space-y-4">
      <header>
        <h1 className="font-serif text-3xl font-bold text-primary">Daily queue</h1>
        <p className="text-sm text-muted-foreground">
          Top {rows.length} eviction filings ranked by Claude risk score. Newest filings break ties.
        </p>
      </header>

      <DocketFilters values={values} />

      {rows.length === 0 ? (
        <Card>
          <CardHeader>
            {filtersActive ? (
              <>
                <CardTitle>No filings match these filters</CardTitle>
                <CardDescription>Relax the filter criteria above and try again.</CardDescription>
              </>
            ) : (
              <>
                <CardTitle>No filings ingested yet</CardTitle>
                <CardDescription>
                  See the{' '}
                  <Link href="/app/cases/filings" className="underline hover:text-primary">
                    Filings page
                  </Link>{' '}
                  to load synthetic data, or wait for the daily scraper to populate.
                </CardDescription>
              </>
            )}
          </CardHeader>
          <CardContent />
        </Card>
      ) : (
        <DocketTable rows={rows} />
      )}
    </div>
  );
}
