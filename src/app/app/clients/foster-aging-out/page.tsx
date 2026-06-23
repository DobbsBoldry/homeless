import Link from 'next/link';
import { listFosterYouth, listUnacknowledgedAlerts } from '@/db/queries/foster-youth';
import { requireRole } from '@/lib/auth';
import { classifyTier, computeDaysUntilEighteen, countSupportsInPlace } from '@/lib/subp';

export const dynamic = 'force-dynamic';

const TIER_BADGE: Record<string, string> = {
  aged_out: 'bg-zinc-200 text-zinc-700 dark:bg-zinc-800 dark:text-zinc-300',
  critical: 'bg-red-100 text-red-700 dark:bg-red-900/40 dark:text-red-400',
  urgent: 'bg-orange-100 text-orange-700 dark:bg-orange-900/40 dark:text-orange-400',
  soon: 'bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-400',
  watch: 'bg-blue-100 text-blue-700 dark:bg-blue-900/40 dark:text-blue-400',
  safe: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-400',
};

export default async function FosterAgingOutPage() {
  await requireRole(['caseworker', 'admin']);

  const [youth, unackAlerts] = await Promise.all([
    listFosterYouth({ status: 'any' }),
    listUnacknowledgedAlerts(),
  ]);

  const asOf = new Date();
  const ranked = youth
    .map((y) => {
      const days = computeDaysUntilEighteen(y.dateOfBirth, asOf);
      return { youth: y, days, tier: classifyTier(days) };
    })
    .sort((a, b) => a.days - b.days);

  const unackByYouth = unackAlerts.reduce<Record<string, number>>((acc, a) => {
    acc[a.youthId] = (acc[a.youthId] ?? 0) + 1;
    return acc;
  }, {});

  return (
    <div className="mx-auto max-w-5xl space-y-6 p-4 md:p-6">
      <div className="text-xs">
        <Link href="/app/clients" className="text-muted-foreground hover:underline">
          ← Back to clients
        </Link>
      </div>
      <header>
        <h1 className="font-serif text-3xl font-bold text-primary">Foster aging-out</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Foster youth in DCBS custody, ranked by days until 18th birthday. Per{' '}
          <Link
            href="/agreements/dcbs/template"
            className="underline underline-offset-2 hover:text-foreground"
          >
            ADR 0006
          </Link>
          , individual records appear here only when an active DCBS DSA authorizes them. Synthetic
          data only until BAA closes.
        </p>
      </header>

      {unackAlerts.length > 0 && (
        <div className="rounded-md border border-amber-500/40 bg-amber-500/5 p-3 text-sm">
          <p className="font-medium">
            {unackAlerts.length} unacknowledged alert{unackAlerts.length === 1 ? '' : 's'}
          </p>
          <p className="mt-1 text-xs text-muted-foreground">
            Click a youth row to review milestone alerts and acknowledge.
          </p>
        </div>
      )}

      {ranked.length === 0 ? (
        <div className="rounded-md border border-border bg-muted/20 p-6 text-sm">
          <p className="font-semibold">No foster youth on file.</p>
          <p className="mt-2 text-muted-foreground">
            Run <code className="font-mono">pnpm tsx scripts/gen-synthetic-foster-youth.ts</code> to
            seed synthetic data, or wait for the DCBS feed (post-integration).
          </p>
        </div>
      ) : (
        <>
          {/* Desktop: table. Mobile: card stack (no horizontal scroll). */}
          <div className="hidden overflow-x-auto rounded-md border border-border md:block">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b bg-muted/30 text-left">
                  <th className="px-3 py-2 font-medium">Name</th>
                  <th className="px-3 py-2 font-medium">Days to 18</th>
                  <th className="px-3 py-2 font-medium">Tier</th>
                  <th className="px-3 py-2 font-medium">Placement</th>
                  <th className="px-3 py-2 font-medium">Supports</th>
                  <th className="px-3 py-2 font-medium">Alerts</th>
                </tr>
              </thead>
              <tbody>
                {ranked.map(({ youth: y, days, tier }) => {
                  const supports = countSupportsInPlace(y.supportsInPlace);
                  const unackCount = unackByYouth[y.id] ?? 0;
                  return (
                    <tr key={y.id} className="border-b last:border-0 hover:bg-muted/10">
                      <td className="px-3 py-2">
                        <Link
                          href={`/app/clients/foster-aging-out/${y.id}`}
                          className="font-medium hover:underline"
                        >
                          {y.legalFirstName} {y.legalLastName}
                        </Link>
                        <div className="text-[10px] font-mono text-muted-foreground">
                          case {y.dcbsCaseId}
                        </div>
                      </td>
                      <td className="px-3 py-2 tabular-nums">
                        {days < 0 ? `+${Math.abs(days)}d past` : `${days}d`}
                      </td>
                      <td className="px-3 py-2">
                        <span
                          className={`rounded px-1.5 py-0.5 text-[10px] font-medium ${TIER_BADGE[tier] ?? ''}`}
                        >
                          {tier}
                        </span>
                      </td>
                      <td className="px-3 py-2 capitalize">{y.placementType.replace(/_/g, ' ')}</td>
                      <td className="px-3 py-2">
                        <span className="text-muted-foreground">{supports}/4</span>
                      </td>
                      <td className="px-3 py-2">
                        {unackCount > 0 ? (
                          <span className="rounded bg-amber-100 px-1.5 py-0.5 text-[10px] font-medium text-amber-700 dark:bg-amber-900/40 dark:text-amber-400">
                            {unackCount} unack
                          </span>
                        ) : (
                          <span className="text-muted-foreground">—</span>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
          <ul className="space-y-2 md:hidden">
            {ranked.map(({ youth: y, days, tier }) => {
              const supports = countSupportsInPlace(y.supportsInPlace);
              const unackCount = unackByYouth[y.id] ?? 0;
              return (
                <li key={y.id} className="rounded-md border border-border bg-card p-3 text-sm">
                  <div className="flex items-start justify-between gap-2">
                    <Link
                      href={`/app/clients/foster-aging-out/${y.id}`}
                      className="font-medium hover:underline"
                    >
                      {y.legalFirstName} {y.legalLastName}
                    </Link>
                    <span
                      className={`shrink-0 rounded px-1.5 py-0.5 text-[10px] font-medium ${TIER_BADGE[tier] ?? ''}`}
                    >
                      {tier}
                    </span>
                  </div>
                  <div className="font-mono text-[10px] text-muted-foreground">
                    case {y.dcbsCaseId}
                  </div>
                  <dl className="mt-2 grid grid-cols-2 gap-x-3 gap-y-1 text-xs text-muted-foreground">
                    <div>
                      <dt className="inline font-medium">To 18: </dt>
                      <dd className="inline tabular-nums">
                        {days < 0 ? `+${Math.abs(days)}d past` : `${days}d`}
                      </dd>
                    </div>
                    <div>
                      <dt className="inline font-medium">Supports: </dt>
                      <dd className="inline">{supports}/4</dd>
                    </div>
                    <div className="capitalize">
                      <dt className="inline font-medium">Placement: </dt>
                      <dd className="inline">{y.placementType.replace(/_/g, ' ')}</dd>
                    </div>
                    <div>
                      <dt className="inline font-medium">Alerts: </dt>
                      <dd className="inline">{unackCount > 0 ? `${unackCount} unack` : '—'}</dd>
                    </div>
                  </dl>
                </li>
              );
            })}
          </ul>
        </>
      )}
    </div>
  );
}
