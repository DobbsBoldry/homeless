import { PartnerDirectory } from '@/components/coalition/partner-directory';
import { listPartnerOrgs } from '@/db/queries/coalition';
import { requireUser } from '@/lib/auth';

export default async function CoalitionPage() {
  await requireUser();
  const orgs = await listPartnerOrgs();
  const aggregateCount = orgs.filter((o) => o.dataSharingTier !== 'none').length;

  return (
    <div className="mx-auto max-w-6xl space-y-4 p-6">
      <header>
        <h1 className="font-serif text-3xl font-bold text-primary">Coalition</h1>
        <p className="text-sm text-muted-foreground">
          Daviess County homelessness-response stakeholders catalogued in the pilot report.
          {orgs.length} organizations · {aggregateCount} actively contributing data ·{' '}
          {orgs.length - aggregateCount} not yet on the data trust.
        </p>
      </header>
      <PartnerDirectory orgs={orgs} />
    </div>
  );
}
