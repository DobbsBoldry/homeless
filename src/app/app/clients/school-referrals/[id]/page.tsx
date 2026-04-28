/**
 * COOR-014 — Caseworker single-referral detail page.
 *
 * Shows the referral's current state and provides a status-transition form
 * with an optional confirmation note. Gated to admin + caseworker (the two
 * roles that can manage referrals on the coalition side).
 *
 * This is an intentionally minimal page — a full caseworker queue UI is
 * deferred to a follow-up sprint.
 */
import { notFound } from 'next/navigation';
import { SchoolReferralStatusForm } from '@/components/dtrs/school-referral-status-form';
import { getSchoolReferral, getSchoolReferralStatusEvents } from '@/db/queries/school-referrals';
import { requireRole } from '@/lib/auth';

export const dynamic = 'force-dynamic';

interface Props {
  params: Promise<{ id: string }>;
}

export default async function SchoolReferralDetailPage({ params }: Props) {
  const { id } = await params;
  const actor = await requireRole(['admin', 'caseworker']);

  const referral = await getSchoolReferral(id, { userId: actor.id, role: actor.role });
  if (!referral) notFound();

  const events = await getSchoolReferralStatusEvents(id);

  return (
    <div className="mx-auto max-w-2xl space-y-6 p-4 md:p-6">
      <header>
        <h1 className="font-serif text-3xl font-bold text-primary">School referral</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Student: {referral.studentFirstInitial}.
          {referral.studentGradeBand ? ` Grade band: ${referral.studentGradeBand}.` : ''}
          {referral.studentAge ? ` Age: ${referral.studentAge}.` : ''}
        </p>
      </header>

      {/* Current state */}
      <section className="rounded-md border p-4 space-y-2">
        <h2 className="font-semibold text-sm uppercase tracking-wide text-muted-foreground">
          Referral details
        </h2>
        <dl className="grid grid-cols-2 gap-x-4 gap-y-1 text-sm">
          <dt className="text-muted-foreground">Status</dt>
          <dd className="font-medium">{referral.status.replace(/_/g, ' ')}</dd>
          <dt className="text-muted-foreground">Urgency</dt>
          <dd>{referral.urgency}</dd>
          <dt className="text-muted-foreground">Received</dt>
          <dd>{referral.receivedAt.toLocaleDateString()}</dd>
          <dt className="text-muted-foreground">Housing situation</dt>
          <dd className="col-span-2">{referral.housingSituation}</dd>
          {referral.notes && (
            <>
              <dt className="text-muted-foreground">Notes</dt>
              <dd className="col-span-2">{referral.notes}</dd>
            </>
          )}
        </dl>
      </section>

      {/* Status transition form */}
      <section className="rounded-md border p-4 space-y-3">
        <h2 className="font-semibold text-sm uppercase tracking-wide text-muted-foreground">
          Update status
        </h2>
        <SchoolReferralStatusForm referralId={referral.id} currentStatus={referral.status} />
      </section>

      {/* Status event timeline */}
      {events.length > 0 && (
        <section className="rounded-md border p-4 space-y-3">
          <h2 className="font-semibold text-sm uppercase tracking-wide text-muted-foreground">
            Status history
          </h2>
          <ol className="space-y-3">
            {events.map((evt) => (
              <li key={evt.id} className="text-sm border-l-2 border-muted pl-3 space-y-0.5">
                <div className="flex items-center gap-2">
                  <span className="font-medium">{evt.toStatus.replace(/_/g, ' ')}</span>
                  {evt.fromStatus && (
                    <span className="text-muted-foreground text-xs">
                      (from {evt.fromStatus.replace(/_/g, ' ')})
                    </span>
                  )}
                </div>
                {evt.note && <p className="text-muted-foreground">{evt.note}</p>}
                <p className="text-xs text-muted-foreground">{evt.occurredAt.toLocaleString()}</p>
              </li>
            ))}
          </ol>
        </section>
      )}
    </div>
  );
}
