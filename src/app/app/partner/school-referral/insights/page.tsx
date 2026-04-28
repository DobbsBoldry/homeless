/**
 * PRVN-004 — McKinney-Vento liaison aggregate insights page.
 *
 * Aggregate counterpart to the per-referral dashboard (COOR-014).
 * Same audience (school liaison), same data — rolled up into:
 *   - Connection rate, total referrals, median time-to-connect (headline cards)
 *   - Status distribution table
 *   - Service-request breakdown table
 *
 * Auth: active membership in a partner_org of type='school' (mirrors dashboard).
 * Privacy: disclosure-log written per referral counted (getLiaisonInsights).
 * No PII on this page — all data is aggregate counts.
 *
 * Trailing 28-day window. No filter UI (out of Sprint 9 scope).
 */
import { and, eq } from 'drizzle-orm';
import { notFound } from 'next/navigation';
import { db } from '@/db/client';
import { getLiaisonInsights } from '@/db/queries/school-referrals';
import { orgMemberships } from '@/db/schema/org-memberships';
import { partnerOrgs } from '@/db/schema/partner-orgs';
import { requireUser } from '@/lib/auth';

export const dynamic = 'force-dynamic';

const WINDOW_DAYS = 28;

function trailing28Days(): { since: Date; until: Date } {
  const until = new Date();
  const since = new Date();
  since.setUTCDate(since.getUTCDate() - WINDOW_DAYS);
  since.setUTCHours(0, 0, 0, 0);
  return { since, until };
}

const STATUS_LABELS: Record<string, string> = {
  received: 'Received',
  triaged: 'Triaged',
  in_progress: 'In progress',
  connected: 'Connected',
  closed_unreachable: 'Closed — unreachable',
  closed_completed: 'Closed — completed',
};

function fmtPct(rate: number | null): string {
  if (rate === null) return '—';
  return `${Math.round(rate * 100)}%`;
}

function fmtDays(days: number | null): string {
  if (days === null) return '—';
  return `${days.toFixed(1)} days`;
}

export default async function SchoolReferralInsightsPage() {
  const user = await requireUser();

  // Verify school membership — 404 for non-members (don't reveal the route).
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
    notFound();
  }

  const { since, until } = trailing28Days();
  const insights = await getLiaisonInsights({ userId: user.id, role: user.role }, { since, until });

  return (
    <div className="mx-auto max-w-3xl space-y-8 p-4 md:p-6">
      <header>
        <a
          href="/app/partner/school-referral/dashboard"
          className="mb-4 inline-block text-sm text-muted-foreground underline hover:text-foreground"
        >
          &larr; Back to per-referral dashboard
        </a>
        <h1 className="font-serif text-3xl font-bold text-primary">Referral insights</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Aggregate view of your referrals — trailing {WINDOW_DAYS} days.
        </p>
      </header>

      {/* ------------------------------------------------------------------ */}
      {/* Empty state                                                          */}
      {/* ------------------------------------------------------------------ */}
      {insights.totalReferrals === 0 ? (
        <p className="text-sm text-muted-foreground">
          No referrals in the last {WINDOW_DAYS} days. Submit a referral on the{' '}
          <a href="/app/partner/school-referral/intake" className="underline">
            intake page
          </a>
          .
        </p>
      ) : (
        <>
          {/* ---------------------------------------------------------------- */}
          {/* Headline cards                                                    */}
          {/* ---------------------------------------------------------------- */}
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
            <div className="rounded-lg border bg-card p-4 shadow-sm">
              <p className="text-xs uppercase tracking-wide text-muted-foreground">
                Total referrals
              </p>
              <p className="mt-1 text-3xl font-bold tabular-nums">{insights.totalReferrals}</p>
              <p className="mt-0.5 text-xs text-muted-foreground">last {WINDOW_DAYS} days</p>
            </div>

            <div className="rounded-lg border bg-card p-4 shadow-sm">
              <p className="text-xs uppercase tracking-wide text-muted-foreground">
                Connection rate
              </p>
              <p className="mt-1 text-3xl font-bold tabular-nums">
                {fmtPct(insights.connectionRate)}
              </p>
              <p className="mt-0.5 text-xs text-muted-foreground">
                {insights.connectedCount} of {insights.totalReferrals} connected
              </p>
            </div>

            <div className="rounded-lg border bg-card p-4 shadow-sm">
              <p className="text-xs uppercase tracking-wide text-muted-foreground">
                Median time-to-connect
              </p>
              <p className="mt-1 text-3xl font-bold tabular-nums">
                {fmtDays(insights.medianTimeToConnectDays)}
              </p>
              <p className="mt-0.5 text-xs text-muted-foreground">from referral to connection</p>
            </div>
          </div>

          {/* ---------------------------------------------------------------- */}
          {/* Status distribution                                               */}
          {/* ---------------------------------------------------------------- */}
          <section>
            <h2 className="mb-3 text-base font-semibold">Status breakdown</h2>
            <div className="overflow-x-auto rounded-md border">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b bg-muted/40 text-xs uppercase tracking-wide text-muted-foreground">
                    <th scope="col" className="px-4 py-2 text-left">
                      Status
                    </th>
                    <th scope="col" className="px-4 py-2 text-right">
                      Count
                    </th>
                    <th scope="col" className="px-4 py-2 text-left">
                      Distribution
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {insights.statusDistribution.map(({ status, count }) => {
                    const pct =
                      insights.totalReferrals > 0
                        ? Math.round((count / insights.totalReferrals) * 100)
                        : 0;
                    return (
                      <tr key={status} className="border-b last:border-0">
                        <td className="px-4 py-2 font-medium">{STATUS_LABELS[status] ?? status}</td>
                        <td className="px-4 py-2 text-right tabular-nums">{count}</td>
                        <td className="px-4 py-2">
                          {count > 0 ? (
                            <div className="flex items-center gap-2">
                              <div className="h-2 w-32 overflow-hidden rounded-full bg-muted">
                                <div
                                  className="h-full rounded-full bg-primary"
                                  style={{ width: `${pct}%` }}
                                />
                              </div>
                              <span className="text-xs text-muted-foreground">{pct}%</span>
                            </div>
                          ) : (
                            <span className="text-xs text-muted-foreground">—</span>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </section>

          {/* ---------------------------------------------------------------- */}
          {/* Service breakdown                                                 */}
          {/* ---------------------------------------------------------------- */}
          <section>
            <h2 className="mb-3 text-base font-semibold">Services requested</h2>
            {insights.serviceBreakdown.length === 0 ? (
              <p className="text-sm text-muted-foreground">No services data available.</p>
            ) : (
              <div className="overflow-x-auto rounded-md border">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b bg-muted/40 text-xs uppercase tracking-wide text-muted-foreground">
                      <th scope="col" className="px-4 py-2 text-left">
                        Service
                      </th>
                      <th scope="col" className="px-4 py-2 text-right">
                        Referrals requesting
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {insights.serviceBreakdown.map(({ service, count }) => (
                      <tr key={service} className="border-b last:border-0">
                        <td className="px-4 py-2 font-medium">
                          {service.replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase())}
                        </td>
                        <td className="px-4 py-2 text-right tabular-nums">{count}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </section>
        </>
      )}
    </div>
  );
}
