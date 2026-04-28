/**
 * COOR-014 — McKinney-Vento liaison closed-loop dashboard.
 *
 * Read-only view for school-org members showing their referrals with current
 * status and the latest caseworker confirmation note.
 *
 * Auth: any authenticated user who is an active member of a partner_org with
 * type='school'. Mirrors the intake page auth pattern (PRVN-003).
 *
 * Access: one FERPA § 99.32 disclosure-log row per referral, written inside
 * the read transaction in listReferralsForLiaison (membership + policy enforced
 * there — not deferred to caller, unlike listSchoolReferralsForCaseworker).
 *
 * Privacy posture (ADR 0005 / COOR-014 spec):
 *   - Disclosure log written per read.
 *   - Audit-log metadata: counts and IDs only — never note content.
 *   - Data scoped to viewer's own school orgs only.
 */
import { and, eq } from 'drizzle-orm';
import { notFound } from 'next/navigation';
import { db } from '@/db/client';
import { listReferralsForLiaison } from '@/db/queries/school-referrals';
import { orgMemberships } from '@/db/schema/org-memberships';
import { partnerOrgs } from '@/db/schema/partner-orgs';
import { requireUser } from '@/lib/auth';

export const dynamic = 'force-dynamic';

const STATUS_LABELS: Record<string, string> = {
  received: 'Received',
  triaged: 'Triaged',
  in_progress: 'In progress',
  connected: 'Connected',
  closed_unreachable: 'Closed — unreachable',
  closed_completed: 'Closed — completed',
};

export default async function SchoolReferralLiaisonDashboard() {
  const user = await requireUser();

  // Verify the user is a member of at least one active school-type partner org.
  // We check here for the 404 guard — listReferralsForLiaison also enforces membership
  // internally, but we want to 404 (not render an empty page) for non-members.
  const [schoolMembership] = await db
    .select({ id: orgMemberships.id })
    .from(orgMemberships)
    .innerJoin(partnerOrgs, eq(orgMemberships.partnerOrgId, partnerOrgs.id))
    .where(
      and(
        eq(orgMemberships.userId, user.id),
        eq(partnerOrgs.type, 'school'),
        eq(partnerOrgs.active, true),
      ),
    )
    .limit(1);

  if (!schoolMembership) {
    // Not a school org member — 404 (don't reveal the route to non-members).
    notFound();
  }

  const referrals = await listReferralsForLiaison({ userId: user.id, role: user.role });

  return (
    <div className="mx-auto max-w-3xl space-y-6 p-4 md:p-6">
      <header>
        <div className="flex items-start justify-between gap-4">
          <div>
            <h1 className="font-serif text-3xl font-bold text-primary">Referral status</h1>
            <p className="mt-1 text-sm text-muted-foreground">
              Referrals you submitted and their current status from the coalition.
            </p>
          </div>
          <a
            href="/app/partner/school-referral/insights"
            className="shrink-0 text-sm text-muted-foreground underline hover:text-foreground"
          >
            View aggregate insights &rarr;
          </a>
        </div>
      </header>

      {referrals.length === 0 ? (
        <p className="text-sm text-muted-foreground">
          No referrals found for your school. Submit a referral on the{' '}
          <a href="/app/partner/school-referral/intake" className="underline">
            intake page
          </a>
          .
        </p>
      ) : (
        <ul className="space-y-4">
          {referrals.map((r) => (
            <li key={r.id} className="rounded-md border p-4 space-y-2">
              <div className="flex items-center justify-between gap-4">
                <div className="space-y-0.5">
                  <p className="font-medium text-sm">
                    Student: {r.studentFirstInitial}.
                    {r.studentGradeBand ? ` (${r.studentGradeBand})` : ''}
                    {r.studentAge ? ` age ${r.studentAge}` : ''}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    Received {r.receivedAt.toLocaleDateString()}
                  </p>
                </div>
                <span className="shrink-0 rounded-full bg-muted px-2.5 py-0.5 text-xs font-medium">
                  {STATUS_LABELS[r.status] ?? r.status}
                </span>
              </div>

              {/* Latest caseworker note */}
              {r.latestEvent?.note ? (
                <details className="text-sm">
                  <summary className="cursor-pointer text-muted-foreground hover:text-foreground">
                    Latest update — {r.latestEvent.occurredAt.toLocaleDateString()}
                  </summary>
                  <p className="mt-1 whitespace-pre-wrap text-foreground">{r.latestEvent.note}</p>
                </details>
              ) : r.latestEvent ? (
                <p className="text-xs text-muted-foreground">
                  Status updated {r.latestEvent.occurredAt.toLocaleDateString()} — no note provided.
                </p>
              ) : (
                <p className="text-xs text-muted-foreground">No updates yet.</p>
              )}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
