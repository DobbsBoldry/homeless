import { CareQueueFilters, type CareQueueFilterValues } from '@/components/esuc/care-queue-filters';
import { CareQueueTable } from '@/components/esuc/care-queue-table';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { listSuperUtilizers } from '@/db/queries/ed-encounters';
import { type HousingStatus, housingStatusEnum } from '@/db/schema/enums';
import { requireRole } from '@/lib/auth';

const ALLOWED_HOUSING: HousingStatus[] = [...housingStatusEnum.enumValues];

const parseMinVisits = (raw: string | undefined): number | undefined => {
  if (!raw) return undefined;
  const n = Number(raw);
  if (!Number.isFinite(n) || n < 1) return undefined;
  return Math.min(50, Math.trunc(n));
};

const parseHousing = (raw: string | string[] | undefined): HousingStatus[] => {
  if (!raw) return [];
  const arr = Array.isArray(raw) ? raw : [raw];
  return arr.filter((s): s is HousingStatus => ALLOWED_HOUSING.includes(s as HousingStatus));
};

export default async function CareQueuePage({
  searchParams,
}: {
  searchParams: Promise<{ min_visits?: string; housing_status?: string | string[] }>;
}) {
  await requireRole(['ed_coordinator', 'admin']);

  const params = await searchParams;
  const minVisits = parseMinVisits(params.min_visits);
  const housingStatuses = parseHousing(params.housing_status);

  const values: CareQueueFilterValues = { minVisits, housingStatuses };
  const filtersActive = Boolean(minVisits || housingStatuses.length > 0);

  // Always pull through the strict super-utilizer query (housing-instability
  // gate is built in). The optional minVisits user-filter just *raises* the
  // threshold; lowering below 3 is intentionally not exposed in the UI to
  // keep the queue coherent with the EVDT-style 'flag list' framing.
  const rows = await listSuperUtilizers({
    visitsThreshold: minVisits && minVisits > 3 ? minVisits : 3,
    limit: 50,
  });

  // Client-side housing filter on the already-housing-unstable rows: the
  // strict query only returns shelter/unsheltered/doubled_up patients, so
  // 'housed' or 'unknown' filters intentionally produce empty results
  // (with the empty-state copy explaining why).
  const filtered =
    housingStatuses.length > 0
      ? rows.filter((r) => housingStatuses.includes(r.housingStatus))
      : rows;

  return (
    <div className="mx-auto max-w-6xl space-y-4 p-6">
      <header>
        <h1 className="font-serif text-3xl font-bold text-primary">Care queue</h1>
        <p className="text-sm text-muted-foreground">
          ED super-utilizers (3+ visits in 180 days, housing-unstable) for care-coordinator
          outreach. Patient identifiers are opaque — names live in Epic, not here.
        </p>
      </header>

      <CareQueueFilters values={values} />

      {filtered.length === 0 ? (
        <Card>
          <CardHeader>
            {filtersActive ? (
              <>
                <CardTitle>No patients match these filters</CardTitle>
                <CardDescription>
                  Note: the underlying flag list is already filtered to housing-unstable patients
                  (shelter / unsheltered / doubled_up). Filtering on 'housed' or 'unknown' returns
                  nothing here.
                </CardDescription>
              </>
            ) : (
              <>
                <CardTitle>No super-utilizers detected in the last 180 days</CardTitle>
                <CardDescription>
                  Try lowering the visit threshold above, or load synthetic ED data via
                  <code className="ml-1 font-mono">pnpm tsx scripts/load-ed-encounters.ts</code>.
                </CardDescription>
              </>
            )}
          </CardHeader>
          <CardContent />
        </Card>
      ) : (
        <CareQueueTable rows={filtered} />
      )}
    </div>
  );
}
