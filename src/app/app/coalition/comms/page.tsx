import Link from 'next/link';
import ReactMarkdown from 'react-markdown';
import { CommsAdvisoryEndButton } from '@/components/coalition/comms-advisory-end-button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { getActiveCommsAdvisory, listCommsAdvisories } from '@/db/queries/comms-advisories';
import { requireRole } from '@/lib/auth';

export const dynamic = 'force-dynamic';

const STAFF_ROLES = ['admin', 'attorney', 'caseworker', 'ed_coordinator', 'shelter_staff'] as const;

const fmtTime = (d: Date) =>
  new Intl.DateTimeFormat('en-US', { dateStyle: 'medium', timeStyle: 'short' }).format(new Date(d));

export default async function CommsAdvisoriesPage() {
  await requireRole(STAFF_ROLES);
  const [active, history] = await Promise.all([getActiveCommsAdvisory(), listCommsAdvisories(20)]);

  return (
    <div className="mx-auto max-w-3xl space-y-4 p-4 md:p-6">
      <header className="flex flex-wrap items-baseline justify-between gap-2">
        <div>
          <h1 className="font-serif text-3xl font-bold text-primary">
            Communications coordination
          </h1>
          <p className="text-sm text-muted-foreground">
            One voice during a crisis. Post the agreed statement and designated spokesperson; every
            signed-in user sees a banner until you end the advisory.
          </p>
        </div>
        <Link
          href="/app/coalition/comms/new"
          className="inline-flex h-9 items-center rounded-md bg-primary px-4 text-sm text-primary-foreground hover:bg-primary/90"
        >
          New advisory
        </Link>
      </header>

      {active ? (
        <Card className="border-destructive bg-destructive/5">
          <CardHeader className="flex flex-row items-baseline justify-between gap-2">
            <div>
              <p className="text-xs uppercase tracking-wide text-destructive">Active advisory</p>
              <CardTitle className="text-base">{active.title}</CardTitle>
            </div>
            <CommsAdvisoryEndButton advisoryId={active.id} />
          </CardHeader>
          <CardContent className="space-y-3">
            <p className="text-sm">
              <strong>Spokesperson:</strong> {active.spokespersonName}
              {active.spokespersonContact ? (
                <span className="text-muted-foreground"> · {active.spokespersonContact}</span>
              ) : null}
            </p>
            <article className="prose prose-sm max-w-none dark:prose-invert">
              <ReactMarkdown>{active.bodyMd}</ReactMarkdown>
            </article>
            <p className="text-xs text-muted-foreground">
              Posted {fmtTime(active.createdAt)}. Refer all reporters to the spokesperson above.
            </p>
          </CardContent>
        </Card>
      ) : (
        <Card>
          <CardContent className="text-sm text-muted-foreground">
            No active advisory. Coalition is operating under normal communications protocol — anyone
            may speak about their own pillar of work; for cross-coalition matters, route through Bo
            or your epic lead.
          </CardContent>
        </Card>
      )}

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Advisory history</CardTitle>
        </CardHeader>
        <CardContent>
          {history.length === 0 ? (
            <p className="text-sm text-muted-foreground">No advisories recorded yet.</p>
          ) : (
            <ul className="divide-y divide-border text-sm">
              {history.map((a) => (
                <li key={a.id} className="flex flex-wrap items-baseline justify-between gap-2 py-2">
                  <span className="font-medium">{a.title}</span>
                  <span className="text-xs text-muted-foreground">
                    {a.active ? (
                      <span className="text-destructive">active</span>
                    ) : (
                      <span>ended {a.endedAt ? fmtTime(a.endedAt) : '—'}</span>
                    )}{' '}
                    · spokesperson {a.spokespersonName}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
