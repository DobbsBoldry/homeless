import Link from 'next/link';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { getMetricsKpis } from '@/db/queries/metrics';
import { activeBedHoldCounts, listActiveShelters } from '@/db/queries/shelters';
import type { UserRole } from '@/db/schema/enums';
import { requireUser } from '@/lib/auth';
import { effectiveFreeBeds } from '@/lib/coordination';

export const dynamic = 'force-dynamic';

type Tile = {
  label: string;
  href: string;
  description: string;
  roles: UserRole[] | 'all';
};

const TILES: Tile[] = [
  {
    label: 'Daily queue',
    href: '/app/cases/queue',
    description: 'AI-ranked filings for today, response packets ready to draft.',
    roles: ['attorney'],
  },
  {
    label: 'Care queue',
    href: '/app/care/queue',
    description: 'Daily ED super-utilizer cohort with care-plan suggestions.',
    roles: ['ed_coordinator', 'admin'],
  },
  {
    label: 'Bed availability',
    href: '/app/coalition/beds',
    description: 'Live across Daviess shelters with filters + 90-min holds.',
    roles: ['attorney', 'caseworker', 'ed_coordinator', 'shelter_staff', 'admin'],
  },
  {
    label: 'Update beds',
    href: '/app/coalition/beds/update',
    description: 'Tap −1 / +1 as beds turn over.',
    roles: ['shelter_staff', 'admin'],
  },
  {
    label: 'Benefits screener',
    href: '/app/clients/screener',
    description: 'SNAP, KCHIP, Medicaid, KTAP, SSI, VA, LIHEAP eligibility.',
    roles: ['caseworker', 'shelter_staff', 'admin'],
  },
  {
    label: 'Triage tier',
    href: '/app/clients/triage',
    description: 'Rule-based housing-stability tier with explainable factors.',
    roles: ['caseworker', 'shelter_staff', 'admin'],
  },
  {
    label: 'Consent link',
    href: '/app/clients/consent-link',
    description: 'Mint a 24h consent-form link for a client.',
    roles: ['caseworker', 'shelter_staff', 'admin'],
  },
  {
    label: 'SMS bed-finder',
    href: '/app/coalition/sms',
    description: 'Simulate inbound SMS to preview the caller experience.',
    roles: ['caseworker', 'ed_coordinator', 'shelter_staff', 'admin'],
  },
  {
    label: 'Cross-org coordination',
    href: '/app/coalition/coordination',
    description: 'People touching ≥ 2 partners in the last 14 days.',
    roles: ['attorney', 'caseworker', 'ed_coordinator', 'shelter_staff', 'admin'],
  },
  {
    label: 'Coalition directory',
    href: '/app/coalition',
    description: 'Daviess homelessness-response stakeholders.',
    roles: 'all',
  },
];

const ROLE_LABEL: Record<UserRole, string> = {
  pending: 'Pending',
  attorney: 'Attorney',
  caseworker: 'Caseworker',
  ed_coordinator: 'ED coordinator',
  shelter_staff: 'Shelter staff',
  admin: 'Admin',
};

export default async function DashboardPage() {
  const user = await requireUser();
  const isPending = user.role === 'pending';

  const [kpis, shelters, holdCounts] = await Promise.all([
    getMetricsKpis(30),
    listActiveShelters(),
    activeBedHoldCounts(),
  ]);

  const totalFreeBeds = shelters.reduce(
    (sum, s) => sum + effectiveFreeBeds(s, holdCounts.get(s.id) ?? 0),
    0,
  );
  const totalCapacity = shelters.reduce((sum, s) => sum + s.capacity, 0);

  const tiles = TILES.filter((t) => t.roles === 'all' || t.roles.includes(user.role));

  return (
    <div className="mx-auto max-w-6xl space-y-4 p-6">
      <header>
        <h1 className="font-serif text-3xl font-bold text-primary">
          Welcome, {user.firstName ?? user.email}
        </h1>
        <p className="text-sm text-muted-foreground">
          {ROLE_LABEL[user.role]} · <code className="font-mono text-xs">{user.email}</code>
        </p>
      </header>

      {isPending ? (
        <Card className="border-amber-500/40 bg-amber-500/5">
          <CardHeader>
            <CardTitle className="text-base">Awaiting role assignment</CardTitle>
          </CardHeader>
          <CardContent className="text-sm text-muted-foreground">
            An admin needs to assign you a role (attorney, caseworker, ED coordinator, shelter
            staff). Until then, only the coalition directory and this dashboard are visible.
          </CardContent>
        </Card>
      ) : null}

      <div className="grid gap-4 md:grid-cols-3">
        <Card>
          <CardContent>
            <p className="text-xs uppercase tracking-wide text-muted-foreground">
              Filings (30 days)
            </p>
            <p className="text-3xl font-semibold">{kpis.filingsInWindow}</p>
            <p className="text-xs text-muted-foreground">
              {kpis.filingsWithPacket} with response packets drafted
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardContent>
            <p className="text-xs uppercase tracking-wide text-muted-foreground">
              Beds free coalition-wide
            </p>
            <p className="text-3xl font-semibold text-emerald-600 dark:text-emerald-400">
              {totalFreeBeds}
            </p>
            <p className="text-xs text-muted-foreground">of {totalCapacity} capacity</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent>
            <p className="text-xs uppercase tracking-wide text-muted-foreground">
              Outcomes recorded
            </p>
            <p className="text-3xl font-semibold">{kpis.outcomesRecorded}</p>
            <p className="text-xs text-muted-foreground">across all time</p>
          </CardContent>
        </Card>
      </div>

      {tiles.length > 0 ? (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Quick links</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid gap-3 md:grid-cols-2 lg:grid-cols-3">
              {tiles.map((t) => (
                <Link
                  key={t.href}
                  href={t.href}
                  className="block rounded-md border border-border bg-card p-3 text-sm hover:bg-muted/50"
                >
                  <p className="font-medium">{t.label}</p>
                  <p className="mt-1 text-xs text-muted-foreground">{t.description}</p>
                </Link>
              ))}
            </div>
          </CardContent>
        </Card>
      ) : null}
    </div>
  );
}
