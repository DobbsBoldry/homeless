import Link from 'next/link';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { listCrossOrgTouchpointsForViewer } from '@/db/queries/partner-service-events';
import { requireRole } from '@/lib/auth';

export const dynamic = 'force-dynamic';

const fmtDateTime = (d: Date) =>
  new Intl.DateTimeFormat('en-US', { dateStyle: 'medium' }).format(new Date(d));

export default async function ClientsPage() {
  const me = await requireRole(['caseworker', 'ed_coordinator', 'shelter_staff', 'admin']);
  const touchpoints = await listCrossOrgTouchpointsForViewer({ windowDays: 14, limit: 8 }, me.role);

  return (
    <div className="mx-auto max-w-5xl space-y-4 p-6">
      <header>
        <h1 className="font-serif text-3xl font-bold text-primary">Clients</h1>
        <p className="text-sm text-muted-foreground">
          Caseworker tools and the cross-agency view. Real per-person records gated behind PHI
          consent + BAA — Phase 1 surfaces work against synthetic person refs.
        </p>
      </header>

      <div className="grid gap-3 md:grid-cols-3">
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Benefits screener</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2 text-sm">
            <p className="text-muted-foreground">
              Quick eligibility check across SNAP, KCHIP, KY Medicaid, KTAP, SSI, VA, LIHEAP.
            </p>
            <Link
              href="/app/clients/screener"
              className="inline-flex h-9 items-center rounded-md bg-primary px-4 text-sm text-primary-foreground hover:bg-primary/90"
            >
              Open screener →
            </Link>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">Triage tier</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2 text-sm">
            <p className="text-muted-foreground">
              Rule-based housing-stability potential with explainable factors.
            </p>
            <Link
              href="/app/clients/triage"
              className="inline-flex h-9 items-center rounded-md border border-input bg-card px-4 text-sm hover:bg-muted"
            >
              Open tool →
            </Link>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">Consent link</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2 text-sm">
            <p className="text-muted-foreground">
              Mint a 24-hour single-resource link a client can use to grant or revoke their sharing
              settings.
            </p>
            <Link
              href="/app/clients/consent-link"
              className="inline-flex h-9 items-center rounded-md border border-input bg-card px-4 text-sm hover:bg-muted"
            >
              Mint link →
            </Link>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Cross-org coordination (last 14 days)</CardTitle>
        </CardHeader>
        <CardContent>
          {touchpoints.length === 0 ? (
            <p className="text-sm text-muted-foreground">
              No partner service events in the window. Re-seed (
              <code className="font-mono">pnpm db:seed</code>) for synthetic activity.
            </p>
          ) : (
            <ul className="divide-y divide-border text-sm">
              {touchpoints.map((p) => (
                <li
                  key={p.syntheticPersonRef}
                  className="flex items-baseline justify-between gap-2 py-2"
                >
                  <Link
                    href={`/app/clients/person/${p.syntheticPersonRef}`}
                    className="font-mono text-xs hover:underline"
                  >
                    {p.syntheticPersonRef}
                  </Link>
                  <span className="truncate text-muted-foreground">
                    {p.uniqueOrgs} partner{p.uniqueOrgs === 1 ? '' : 's'} · {p.totalEvents} event
                    {p.totalEvents === 1 ? '' : 's'}
                  </span>
                  <span className="whitespace-nowrap text-xs text-muted-foreground">
                    latest {fmtDateTime(p.latestEventAt)}
                  </span>
                </li>
              ))}
            </ul>
          )}
          <Link
            href="/app/coalition/coordination"
            className="mt-3 inline-block text-xs text-muted-foreground hover:underline"
          >
            See full coordination view →
          </Link>
        </CardContent>
      </Card>

      <Card className="border-amber-500/40 bg-amber-500/5">
        <CardContent className="text-xs">
          <p className="font-medium">Phase-1 scope note.</p>
          <p className="mt-1 text-muted-foreground">
            Real per-person records — the unified care plan that links eviction defense, ED super-
            utilizer flags, and shelter routing — land post-BAA (ESUC-002). Today's surfaces work
            against opaque synthetic refs so the consent + audit plumbing can be exercised before
            real PHI flows.
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
