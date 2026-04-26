import Link from 'next/link';
import { notFound } from 'next/navigation';
import { CaseFilingsRoles } from '@/components/eviction/case-filings-roles';
import { FilingDetail } from '@/components/eviction/filing-detail';
import { getFilingById } from '@/db/queries/eviction-filings';
import { requireRole } from '@/lib/auth';

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export default async function FilingDetailPage({ params }: { params: Promise<{ id: string }> }) {
  await requireRole(CaseFilingsRoles);
  const { id } = await params;

  // Cheap shape check before hitting the DB — pg would 22P02 on a malformed UUID
  if (!UUID_RE.test(id)) notFound();

  const filing = await getFilingById(id);
  if (!filing) notFound();

  return (
    <div className="mx-auto max-w-4xl p-6 space-y-4">
      <div className="text-xs">
        <Link href="/app/cases/filings" className="text-muted-foreground hover:underline">
          ← Back to filings
        </Link>
      </div>
      <FilingDetail filing={filing} />
    </div>
  );
}
