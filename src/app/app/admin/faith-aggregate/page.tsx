import { FaithAggregateIntakeForm } from '@/components/dtrs/faith-aggregate-intake-form';
import { listFaithMinistries } from '@/db/queries/faith-aggregate';
import { requireRole } from '@/lib/auth';

export const dynamic = 'force-dynamic';

export default async function FaithAggregateAdminPage() {
  await requireRole(['admin']);

  const ministries = await listFaithMinistries({ status: 'opted_in' });

  if (ministries.length === 0) {
    return (
      <div className="mx-auto max-w-2xl space-y-4 p-4 md:p-6">
        <header>
          <h1 className="font-serif text-3xl font-bold text-primary">Faith aggregate intake</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Enter aggregate service counts on behalf of an opted-in faith ministry.
          </p>
        </header>
        <div className="rounded-md border border-border bg-muted/20 p-6 text-sm">
          <p className="font-semibold">No opted-in ministries found.</p>
          <p className="mt-2 text-muted-foreground">
            Before this form can be used, at least one faith ministry must be added to the database
            with <code className="font-mono">status = &apos;opted_in&apos;</code>. Adding ministries
            is a partnership-team task — contact the coalition data steward. Running{' '}
            <code className="font-mono">pnpm db:seed</code> will create the Catholic Charities seed
            row if the database has not been seeded yet.
          </p>
        </div>
      </div>
    );
  }

  const ministryOptions = ministries.map((m) => ({
    id: m.id,
    name: m.name,
    minCellSize: m.minCellSize,
  }));

  return (
    <div className="mx-auto max-w-2xl space-y-4 p-4 md:p-6">
      <header>
        <h1 className="font-serif text-3xl font-bold text-primary">Faith aggregate intake</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Enter aggregate service counts on behalf of an opted-in faith ministry. All data is
          aggregate-only — no individual names, identifiers, or free-text demographics. Counts below
          the ministry&apos;s cell-size threshold are automatically suppressed before storage.
        </p>
      </header>
      <FaithAggregateIntakeForm ministries={ministryOptions} />
    </div>
  );
}
