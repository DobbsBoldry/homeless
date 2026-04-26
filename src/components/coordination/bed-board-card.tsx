import { BedHoldControls } from '@/components/coordination/bed-hold-controls';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import type { BedHoldWithHolder, ShelterWithOrg } from '@/db/queries/shelters';
import { effectiveFreeBeds, freeBeds, occupancyRate } from '@/lib/coordination/bed-availability';

const fmtTime = (d: Date) =>
  new Intl.DateTimeFormat('en-US', { dateStyle: 'medium', timeStyle: 'short' }).format(new Date(d));

function popChips(shelter: ShelterWithOrg): string[] {
  const chips: string[] = [];
  if (shelter.acceptsMen) chips.push('Men');
  if (shelter.acceptsWomen) chips.push('Women');
  if (shelter.acceptsFamilies) chips.push('Families');
  if (shelter.petFriendly) chips.push('Pet-friendly');
  if (shelter.sudFriendly) chips.push('SUD-OK');
  return chips;
}

export function BedBoardCard({
  shelter,
  lastUpdatedAt,
  activeHolds,
  canHold,
}: {
  shelter: ShelterWithOrg;
  lastUpdatedAt: Date | null;
  activeHolds: BedHoldWithHolder[];
  canHold: boolean;
}) {
  const rawFree = freeBeds(shelter);
  const free = effectiveFreeBeds(shelter, activeHolds.length);
  const rate = occupancyRate(shelter);
  const isFull = free === 0;
  const isTight = !isFull && rate >= 0.85;
  const chips = popChips(shelter);

  // Tailwind class lookup (avoid string-built classes that get tree-shaken).
  const barColor = isFull ? 'bg-destructive' : isTight ? 'bg-amber-500' : 'bg-emerald-500';
  const freeColor = isFull
    ? 'text-destructive'
    : isTight
      ? 'text-amber-600 dark:text-amber-400'
      : 'text-emerald-600 dark:text-emerald-400';

  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="text-base">{shelter.name}</CardTitle>
        <p className="text-xs text-muted-foreground">{shelter.partnerOrg.name}</p>
      </CardHeader>
      <CardContent className="space-y-3">
        <div className="flex items-baseline justify-between">
          <div>
            <p className="text-xs uppercase tracking-wide text-muted-foreground">Free</p>
            <p className={`text-3xl font-semibold ${freeColor}`}>{free}</p>
            {activeHolds.length > 0 ? (
              <p className="text-xs text-muted-foreground">
                {rawFree} unoccupied · {activeHolds.length} on hold
              </p>
            ) : null}
          </div>
          <p className="text-sm text-muted-foreground">
            {shelter.currentOccupancy} / {shelter.capacity} occupied
          </p>
        </div>

        <div
          role="progressbar"
          aria-label={`${Math.round(rate * 100)}% full`}
          aria-valuenow={Math.round(rate * 100)}
          aria-valuemin={0}
          aria-valuemax={100}
          className="h-2 overflow-hidden rounded-full bg-muted"
        >
          <div
            className={`h-full ${barColor} transition-all`}
            style={{ width: `${Math.round(rate * 100)}%` }}
          />
        </div>

        {chips.length > 0 ? (
          <div className="flex flex-wrap gap-1">
            {chips.map((c) => (
              <span
                key={c}
                className="rounded bg-secondary px-2 py-0.5 text-xs text-secondary-foreground"
              >
                {c}
              </span>
            ))}
          </div>
        ) : null}

        {shelter.contactPhone ? (
          <p className="text-xs text-muted-foreground">
            <a href={`tel:${shelter.contactPhone}`} className="hover:underline">
              {shelter.contactPhone}
            </a>
            {shelter.city ? ` · ${shelter.city}` : null}
          </p>
        ) : shelter.city ? (
          <p className="text-xs text-muted-foreground">{shelter.city}</p>
        ) : null}

        <p className="text-xs text-muted-foreground">
          {lastUpdatedAt ? `Last update ${fmtTime(lastUpdatedAt)}` : 'No updates yet'}
        </p>

        <BedHoldControls
          shelterId={shelter.id}
          shelterName={shelter.name}
          freeBeds={free}
          activeHolds={activeHolds}
          canHold={canHold}
        />
      </CardContent>
    </Card>
  );
}
