import Link from 'next/link';
import { notFound } from 'next/navigation';
import { PreReleaseDetailClient } from '@/components/subp/pre-release-detail-client';
import { getPreReleaseSubject } from '@/db/queries/pre-release-subjects';
import { requireRole } from '@/lib/auth';
import { classifyReleaseTier, computeDaysUntilRelease } from '@/lib/subp';

export const dynamic = 'force-dynamic';

interface Props {
  params: Promise<{ id: string }>;
}

export default async function PreReleaseSubjectDetailPage({ params }: Props) {
  await requireRole(['caseworker', 'admin']);
  const { id } = await params;

  const subject = await getPreReleaseSubject(id);
  if (!subject) notFound();

  const days = computeDaysUntilRelease(subject.projectedReleaseDate, new Date());
  const tier = classifyReleaseTier(days);

  return (
    <div className="mx-auto max-w-3xl space-y-6 p-4 md:p-6">
      <div className="text-xs">
        <Link href="/app/clients/reentry" className="text-muted-foreground hover:underline">
          ← Back to reentry list
        </Link>
      </div>

      <header>
        <h1 className="font-serif text-3xl font-bold text-primary">
          {subject.legalFirstName} {subject.legalLastName}
        </h1>
        <p className="mt-1 text-sm text-muted-foreground">
          KY DOC inmate <code className="font-mono">{subject.kyDocInmateId}</code> · release type:{' '}
          <span className="capitalize">{subject.releaseType.replace(/_/g, ' ')}</span> ·
          destination: {subject.designatedDestination}
        </p>
      </header>

      <section className="rounded-md border border-border p-4">
        <h2 className="text-sm font-semibold">Release countdown</h2>
        <p className="mt-2 text-2xl font-bold tabular-nums">
          {days < 0 ? `${Math.abs(days)} days past release` : `${days} days to release`}
        </p>
        <p className="mt-1 text-xs text-muted-foreground">
          Tier: <span className="font-medium capitalize">{tier}</span> · projected release{' '}
          {String(subject.projectedReleaseDate)} · DOB {String(subject.dateOfBirth)}
          {subject.handedOffAt && (
            <>
              {' · '}handed off {subject.handedOffAt.toLocaleDateString()}
            </>
          )}
        </p>
      </section>

      <PreReleaseDetailClient
        subjectId={subject.id}
        supportsInPlace={subject.supportsInPlace}
        alreadyHandedOff={subject.handedOffAt !== null}
      />
    </div>
  );
}
