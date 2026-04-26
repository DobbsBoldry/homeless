import { BedCountStaffCard } from '@/components/coordination/bed-count-staff-card';
import { Card, CardContent } from '@/components/ui/card';
import { lastBedCountUpdateByShelter, listActiveShelters } from '@/db/queries/shelters';
import { requireRole } from '@/lib/auth';

export const dynamic = 'force-dynamic';

export default async function BedCountUpdatePage() {
  await requireRole(['shelter_staff', 'admin']);
  const [shelterRows, lastUpdates] = await Promise.all([
    listActiveShelters(),
    lastBedCountUpdateByShelter(),
  ]);

  return (
    <div className="mx-auto max-w-3xl space-y-4 p-4 md:p-6">
      <header>
        <h1 className="font-serif text-3xl font-bold text-primary">Update bed counts</h1>
        <p className="text-sm text-muted-foreground">
          Tap −1 / +1 (or −5 / +5 for fast moves) when a bed turns over. Saves take a second; the
          live availability board picks up the change automatically.
        </p>
      </header>

      {shelterRows.length === 0 ? (
        <Card>
          <CardContent className="text-sm text-muted-foreground">
            No active shelters. Run <code className="font-mono">pnpm db:seed</code> to load the
            Daviess catalog.
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-4 md:grid-cols-2">
          {shelterRows.map((shelter) => (
            <BedCountStaffCard
              key={shelter.id}
              shelter={shelter}
              lastUpdatedAt={lastUpdates.get(shelter.id) ?? null}
            />
          ))}
        </div>
      )}

      <Card className="border-amber-500/40 bg-amber-500/5">
        <CardContent className="text-xs">
          <p className="font-medium">Phase-1 scoping note.</p>
          <p className="mt-1 text-muted-foreground">
            Every shelter_staff user sees every shelter today. Per-shelter membership scoping (so
            St. Benedict's staff only see St. Benedict's) ships with COOR-007 onboarding.
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
