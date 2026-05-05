import Link from 'next/link';
import { listPreReleaseSubjects } from '@/db/queries/pre-release-subjects';
import { requireRole } from '@/lib/auth';
import {
  classifyReleaseTier,
  computeDaysUntilRelease,
  countPreReleaseSupportsInPlace,
} from '@/lib/subp';

export const dynamic = 'force-dynamic';

const TIER_BADGE: Record<string, string> = {
  released: 'bg-zinc-200 text-zinc-700 dark:bg-zinc-800 dark:text-zinc-300',
  critical: 'bg-red-100 text-red-700 dark:bg-red-900/40 dark:text-red-400',
  urgent: 'bg-orange-100 text-orange-700 dark:bg-orange-900/40 dark:text-orange-400',
  soon: 'bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-400',
  planning: 'bg-blue-100 text-blue-700 dark:bg-blue-900/40 dark:text-blue-400',
  watch: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-400',
};

export default async function ReentryListPage() {
  await requireRole(['caseworker', 'admin']);

  const subjects = await listPreReleaseSubjects({ status: 'any' });

  const asOf = new Date();
  const ranked = subjects
    .map((s) => {
      const days = computeDaysUntilRelease(s.projectedReleaseDate, asOf);
      return { subject: s, days, tier: classifyReleaseTier(days) };
    })
    .sort((a, b) => a.days - b.days);

  return (
    <div className="mx-auto max-w-5xl space-y-6 p-4 md:p-6">
      <div className="text-xs">
        <Link href="/app/clients" className="text-muted-foreground hover:underline">
          ← Back to clients
        </Link>
      </div>
      <header>
        <h1 className="font-serif text-3xl font-bold text-primary">Reentry</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Pre-release subjects in KY DOC custody, ranked by days until projected release. Per{' '}
          <Link
            href="/agreements/kydoc/template"
            className="underline underline-offset-2 hover:text-foreground"
          >
            ADR 0009
          </Link>
          , individual records appear here only when an active KY DOC DSA authorizes them and the
          subject&apos;s projected release falls within the agreed pre-release window. Subjects who
          age past 7 days post-release without a warm handoff are deleted by the daily sweep.
          Synthetic data only until BAA closes.
        </p>
      </header>

      {ranked.length === 0 ? (
        <div className="rounded-md border border-border bg-muted/20 p-6 text-sm">
          <p className="font-semibold">No pre-release subjects on file.</p>
          <p className="mt-2 text-muted-foreground">
            Run <code className="font-mono">pnpm tsx scripts/gen-synthetic-pre-release.ts</code> to
            seed synthetic data, or wait for the KY DOC feed (post-integration).
          </p>
        </div>
      ) : (
        <div className="overflow-x-auto rounded-md border border-border">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b bg-muted/30 text-left">
                <th className="px-3 py-2 font-medium">Name</th>
                <th className="px-3 py-2 font-medium">Days to release</th>
                <th className="px-3 py-2 font-medium">Tier</th>
                <th className="px-3 py-2 font-medium">Release type</th>
                <th className="px-3 py-2 font-medium">Destination</th>
                <th className="px-3 py-2 font-medium">Supports</th>
                <th className="px-3 py-2 font-medium">Status</th>
              </tr>
            </thead>
            <tbody>
              {ranked.map(({ subject: s, days, tier }) => {
                const supports = countPreReleaseSupportsInPlace(s.supportsInPlace);
                return (
                  <tr key={s.id} className="border-b last:border-0 hover:bg-muted/10">
                    <td className="px-3 py-2">
                      <Link
                        href={`/app/clients/reentry/${s.id}`}
                        className="font-medium hover:underline"
                      >
                        {s.legalFirstName} {s.legalLastName}
                      </Link>
                      <div className="text-[10px] font-mono text-muted-foreground">
                        inmate {s.kyDocInmateId}
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
                    <td className="px-3 py-2 capitalize">{s.releaseType.replace(/_/g, ' ')}</td>
                    <td className="px-3 py-2 text-xs text-muted-foreground">
                      {s.designatedDestination}
                    </td>
                    <td className="px-3 py-2">
                      <span className="text-muted-foreground">{supports}/5</span>
                    </td>
                    <td className="px-3 py-2">
                      {s.status === 'handed_off' ? (
                        <span className="rounded bg-emerald-100 px-1.5 py-0.5 text-[10px] font-medium text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-400">
                          handed off
                        </span>
                      ) : (
                        <span className="text-muted-foreground">active</span>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
