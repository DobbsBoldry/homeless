import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { listSteeringMeetings } from '@/db/queries/steering-meetings';
import { requireRole } from '@/lib/auth';

export const dynamic = 'force-dynamic';

const STAFF_ROLES = ['admin', 'attorney', 'caseworker', 'ed_coordinator', 'shelter_staff'] as const;

const fmtDate = (iso: string) =>
  new Intl.DateTimeFormat('en-US', { dateStyle: 'medium' }).format(new Date(iso));

export default async function SteeringMeetingsPage() {
  await requireRole(STAFF_ROLES);
  const meetings = await listSteeringMeetings();

  return (
    <div className="mx-auto max-w-4xl space-y-4 p-4 md:p-6">
      <header className="flex flex-wrap items-baseline justify-between gap-2">
        <div>
          <h1 className="font-serif text-3xl font-bold text-primary">Steering Committee</h1>
          <p className="text-sm text-muted-foreground">
            Meeting minutes — agenda, decisions, action items. Markdown body so anyone can paste
            into a coalition newsletter without reformatting.
          </p>
        </div>
        <Link href="/app/coalition/steering/new">
          <Button>New meeting</Button>
        </Link>
      </header>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">All meetings</CardTitle>
        </CardHeader>
        <CardContent>
          {meetings.length === 0 ? (
            <p className="text-sm text-muted-foreground">
              No meetings recorded yet. Click <strong>New meeting</strong> to start.
            </p>
          ) : (
            <ul className="divide-y divide-border text-sm">
              {meetings.map((m) => (
                <li key={m.id} className="flex items-baseline justify-between gap-2 py-2">
                  <Link
                    href={`/app/coalition/steering/${m.id}`}
                    className="font-medium hover:underline"
                  >
                    {m.title}
                  </Link>
                  <span className="text-xs text-muted-foreground">
                    {fmtDate(m.heldOn)} · {m.attendees.length} attendees ·{' '}
                    {m.postedAt ? (
                      <span className="text-emerald-700 dark:text-emerald-400">posted</span>
                    ) : (
                      <span>draft</span>
                    )}
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
