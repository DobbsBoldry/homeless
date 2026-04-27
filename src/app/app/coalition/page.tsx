import Link from 'next/link';
import { PartnerDirectory } from '@/components/coalition/partner-directory';
import { listPartnerOrgs } from '@/db/queries/coalition';
import { requireUser } from '@/lib/auth';

export default async function CoalitionPage() {
  const me = await requireUser();
  const orgs = await listPartnerOrgs();
  const aggregateCount = orgs.filter((o) => o.dataSharingTier !== 'none').length;
  const canSeeInsights = me.role === 'admin' || me.role === 'attorney';

  return (
    <div className="mx-auto max-w-6xl space-y-4 p-6">
      <header className="flex flex-wrap items-baseline justify-between gap-3">
        <div>
          <h1 className="font-serif text-3xl font-bold text-primary">Coalition</h1>
          <p className="text-sm text-muted-foreground">
            Daviess County homelessness-response stakeholders catalogued in the pilot report.
            {orgs.length} organizations · {aggregateCount} actively contributing data ·{' '}
            {orgs.length - aggregateCount} not yet on the data trust.
          </p>
        </div>
        {canSeeInsights ? (
          <Link
            href="/app/coalition/insights"
            className="shrink-0 rounded-md bg-primary px-3 py-2 text-xs font-medium text-primary-foreground hover:bg-primary/90"
          >
            Weekly insights →
          </Link>
        ) : null}
      </header>
      <PartnerDirectory orgs={orgs} />
    </div>
  );
}
