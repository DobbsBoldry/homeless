import Link from 'next/link';
import { notFound } from 'next/navigation';
import { CaseFilingsRoles } from '@/components/eviction/case-filings-roles';
import { CaseOutcomePanel } from '@/components/eviction/case-outcome-panel';
import { FilingDetail } from '@/components/eviction/filing-detail';
import { listCaseOutcomes } from '@/db/queries/eviction-case-outcomes';
import { getFilingById } from '@/db/queries/eviction-filings';
import { requireRole, userIsKlaAttorney } from '@/lib/auth';
import { getLatestScore } from '@/lib/eviction/risk-score';

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export default async function FilingDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const me = await requireRole(CaseFilingsRoles);
  const { id } = await params;

  // Cheap shape check before hitting the DB — pg would 22P02 on a malformed UUID
  if (!UUID_RE.test(id)) notFound();

  const filing = await getFilingById(id);
  if (!filing) notFound();

  const [score, outcomes, canRecord] = await Promise.all([
    getLatestScore(filing.id),
    listCaseOutcomes(filing.id),
    userIsKlaAttorney(me),
  ]);

  return (
    <div className="mx-auto max-w-4xl p-6 space-y-4">
      <div className="text-xs">
        <Link href="/app/cases/filings" className="text-muted-foreground hover:underline">
          ← Back to filings
        </Link>
      </div>
      <FilingDetail filing={filing} score={score} />
      <div className="rounded-md border border-border bg-card p-4 text-sm">
        <p className="mb-2 font-medium">Response packet</p>
        <p className="mb-3 text-xs text-muted-foreground">
          Draft, review, and approve the AI-generated Answer to Forcible Detainer Complaint (KLA
          attorneys only).
        </p>
        <Link
          href={`/app/cases/filings/${id}/packet`}
          className="inline-flex h-9 items-center rounded-md bg-primary px-4 text-sm text-primary-foreground hover:bg-primary/90"
        >
          Open packet workspace →
        </Link>
      </div>
      <CaseOutcomePanel filingId={filing.id} history={outcomes} canRecord={canRecord} />
    </div>
  );
}
