import Link from 'next/link';
import { notFound } from 'next/navigation';
import { FosterYouthDetailClient } from '@/components/subp/foster-youth-detail-client';
import { getFosterYouth, listAlertsForYouth } from '@/db/queries/foster-youth';
import { requireRole } from '@/lib/auth';
import { classifyTier, computeDaysUntilEighteen } from '@/lib/subp';

export const dynamic = 'force-dynamic';

interface Props {
  params: Promise<{ id: string }>;
}

export default async function FosterYouthDetailPage({ params }: Props) {
  await requireRole(['caseworker', 'admin']);
  const { id } = await params;

  const youth = await getFosterYouth(id);
  if (!youth) notFound();

  const alerts = await listAlertsForYouth(youth.id);
  const days = computeDaysUntilEighteen(youth.dateOfBirth, new Date());
  const tier = classifyTier(days);

  return (
    <div className="mx-auto max-w-3xl space-y-6 p-4 md:p-6">
      <div className="text-xs">
        <Link
          href="/app/clients/foster-aging-out"
          className="text-muted-foreground hover:underline"
        >
          ← Back to foster aging-out list
        </Link>
      </div>

      <header>
        <h1 className="font-serif text-3xl font-bold text-primary">
          {youth.legalFirstName} {youth.legalLastName}
        </h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Case <code className="font-mono">{youth.dcbsCaseId}</code> · placement:{' '}
          <span className="capitalize">{youth.placementType.replace(/_/g, ' ')}</span> ·{' '}
          {youth.placementChangesCount} placement change
          {youth.placementChangesCount === 1 ? '' : 's'}
        </p>
      </header>

      <section className="rounded-md border border-border p-4">
        <h2 className="text-sm font-semibold">Aging-out countdown</h2>
        <p className="mt-2 text-2xl font-bold tabular-nums">
          {days < 0 ? `${Math.abs(days)} days past 18th birthday` : `${days} days to 18`}
        </p>
        <p className="mt-1 text-xs text-muted-foreground">
          Tier: <span className="font-medium capitalize">{tier}</span> · DOB{' '}
          {String(youth.dateOfBirth)} · status {youth.status}
        </p>
      </section>

      <FosterYouthDetailClient
        youthId={youth.id}
        supportsInPlace={youth.supportsInPlace}
        alerts={alerts.map((a) => ({
          id: a.id,
          milestone: a.milestone,
          firedAt: a.firedAt.toISOString(),
          acknowledgedAt: a.acknowledgedAt ? a.acknowledgedAt.toISOString() : null,
        }))}
      />
    </div>
  );
}
