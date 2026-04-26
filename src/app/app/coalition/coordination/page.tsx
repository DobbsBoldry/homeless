import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { listCrossOrgTouchpoints } from '@/db/queries/partner-service-events';
import { requireRole } from '@/lib/auth';

const WINDOW_DAYS = 14;

const fmtDateTime = (d: Date) =>
  new Intl.DateTimeFormat('en-US', { dateStyle: 'medium', timeStyle: 'short' }).format(new Date(d));

export default async function CrossOrgCoordinationPage() {
  await requireRole(['attorney', 'caseworker', 'ed_coordinator', 'shelter_staff', 'admin']);
  const rows = await listCrossOrgTouchpoints({ windowDays: WINDOW_DAYS, limit: 50 });
  const crossOrg = rows.filter((r) => r.uniqueOrgs >= 2);

  return (
    <div className="mx-auto max-w-6xl space-y-4 p-6">
      <header>
        <h1 className="font-serif text-3xl font-bold text-primary">Cross-org coordination</h1>
        <p className="text-sm text-muted-foreground">
          People who showed up at multiple coalition partners in the last {WINDOW_DAYS} days.
          Identifiers are opaque — names and contact info live with each partner, not here.
        </p>
      </header>

      <Card className="border-amber-500/40 bg-amber-500/5">
        <CardContent className="text-xs">
          <p className="font-medium">PHASE-1 STUB.</p>
          <p className="mt-1 text-muted-foreground">
            Real cross-org data flow requires the data trust governance described in{' '}
            <code className="font-mono">docs/research/Daviess_County_Pilot_Report.md</code> §5
            (consent-first individual data, abuser-blind protocols for DV, faith-based
            accommodations, BAA / QSOA / FERPA frameworks). Today's events are synthetic; the
            opaque-identifier pattern is the same one real data will use.
          </p>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">
            People touching {'\u2265'} 2 partners in the last {WINDOW_DAYS} days{' '}
            <span className="text-xs font-normal text-muted-foreground">({crossOrg.length})</span>
          </CardTitle>
        </CardHeader>
        <CardContent>
          {crossOrg.length === 0 ? (
            <p className="text-sm text-muted-foreground">
              No one in the synthetic catalog has touched 2+ partners in the window. Try re-seeding
              (<code className="font-mono">pnpm db:seed</code>) or widen the window.
            </p>
          ) : (
            <ul className="space-y-2">
              {crossOrg.map((p) => (
                <li
                  key={p.syntheticPersonRef}
                  className="rounded-md border border-border bg-card p-3 text-sm"
                >
                  <div className="mb-1 flex flex-wrap items-baseline justify-between gap-2">
                    <p className="font-mono text-xs font-medium">{p.syntheticPersonRef}</p>
                    <span className="text-xs text-muted-foreground">
                      latest {fmtDateTime(p.latestEventAt)}
                    </span>
                  </div>
                  <p className="text-sm">
                    <strong>
                      {p.uniqueOrgs} partner{p.uniqueOrgs === 1 ? '' : 's'}
                    </strong>{' '}
                    · {p.totalEvents} event{p.totalEvents === 1 ? '' : 's'} ·{' '}
                    <span className="text-muted-foreground">{p.orgNames.join(' · ')}</span>
                  </p>
                </li>
              ))}
            </ul>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">
            Single-partner touches{' '}
            <span className="text-xs font-normal text-muted-foreground">
              ({rows.length - crossOrg.length})
            </span>
          </CardTitle>
        </CardHeader>
        <CardContent className="text-xs text-muted-foreground">
          Visible only as a count today. The full single-partner list isn't useful in the
          coordination view — it's the multi-partner pattern that drives the conversation.
        </CardContent>
      </Card>
    </div>
  );
}
