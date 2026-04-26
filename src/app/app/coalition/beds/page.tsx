import { AutoRefresh } from '@/components/coordination/auto-refresh';
import { BedBoardCard } from '@/components/coordination/bed-board-card';
import { BedBoardFilters } from '@/components/coordination/bed-board-filters';
import { Card, CardContent } from '@/components/ui/card';
import { lastBedCountUpdateByShelter, listActiveShelters } from '@/db/queries/shelters';
import { requireRole } from '@/lib/auth';
import {
  freeBeds,
  hasActiveFilter,
  matchesFilter,
  parseBedFilterParams,
} from '@/lib/coordination/bed-availability';

export const dynamic = 'force-dynamic';

export default async function BedAvailabilityBoardPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  await requireRole(['attorney', 'caseworker', 'ed_coordinator', 'shelter_staff', 'admin']);
  const params = await searchParams;
  const filter = parseBedFilterParams(params);

  const [allShelters, lastUpdates] = await Promise.all([
    listActiveShelters(),
    lastBedCountUpdateByShelter(),
  ]);

  const filtered = allShelters.filter((s) =>
    matchesFilter(s, filter, `${s.name} ${s.partnerOrg.name}`),
  );

  const totalCapacity = filtered.reduce((sum, s) => sum + s.capacity, 0);
  const totalOccupied = filtered.reduce((sum, s) => sum + s.currentOccupancy, 0);
  const totalFree = filtered.reduce((sum, s) => sum + freeBeds(s), 0);
  const filterActive = hasActiveFilter(filter);

  return (
    <div className="mx-auto max-w-6xl space-y-4 p-4 md:p-6">
      <header className="flex flex-wrap items-baseline justify-between gap-2">
        <div>
          <h1 className="font-serif text-3xl font-bold text-primary">Bed availability</h1>
          <p className="text-sm text-muted-foreground">
            Live across {allShelters.length} Daviess shelters. Numbers reflect what staff entered
            most recently in the bed-count update view.
          </p>
        </div>
        <AutoRefresh />
      </header>

      <BedBoardFilters />

      <Card>
        <CardContent className="grid grid-cols-3 gap-3 text-center">
          <div>
            <p className="text-xs uppercase tracking-wide text-muted-foreground">
              Free {filterActive ? '(filtered)' : ''}
            </p>
            <p className="text-2xl font-semibold text-emerald-600 dark:text-emerald-400">
              {totalFree}
            </p>
          </div>
          <div>
            <p className="text-xs uppercase tracking-wide text-muted-foreground">Occupied</p>
            <p className="text-2xl font-semibold">{totalOccupied}</p>
          </div>
          <div>
            <p className="text-xs uppercase tracking-wide text-muted-foreground">Capacity</p>
            <p className="text-2xl font-semibold">{totalCapacity}</p>
          </div>
        </CardContent>
      </Card>

      {allShelters.length === 0 ? (
        <Card>
          <CardContent className="text-sm text-muted-foreground">
            No active shelters. Run <code className="font-mono">pnpm db:seed</code> to load the
            Daviess catalog.
          </CardContent>
        </Card>
      ) : filtered.length === 0 ? (
        <Card>
          <CardContent className="text-sm text-muted-foreground">
            No shelters match the current filters. Try a different preset or clear filters.
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {filtered.map((shelter) => (
            <BedBoardCard
              key={shelter.id}
              shelter={shelter}
              lastUpdatedAt={lastUpdates.get(shelter.id) ?? null}
            />
          ))}
        </div>
      )}
    </div>
  );
}
