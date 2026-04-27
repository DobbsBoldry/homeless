import Link from 'next/link';
import { notFound } from 'next/navigation';
import ReactMarkdown from 'react-markdown';
import { SteeringMeetingForm } from '@/components/coalition/steering-meeting-form';
import { SteeringPostButton } from '@/components/coalition/steering-post-button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { getSteeringMeetingById } from '@/db/queries/steering-meetings';
import { requireRole } from '@/lib/auth';

export const dynamic = 'force-dynamic';

const STAFF_ROLES = ['admin', 'attorney', 'caseworker', 'ed_coordinator', 'shelter_staff'] as const;

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

const fmtDate = (iso: string) =>
  new Intl.DateTimeFormat('en-US', { dateStyle: 'long' }).format(new Date(iso));

const fmtDateTime = (d: Date) =>
  new Intl.DateTimeFormat('en-US', { dateStyle: 'medium', timeStyle: 'short' }).format(new Date(d));

export default async function SteeringMeetingDetailPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ edit?: string }>;
}) {
  await requireRole(STAFF_ROLES);
  const { id } = await params;
  const sp = await searchParams;
  if (!UUID_RE.test(id)) notFound();

  const meeting = await getSteeringMeetingById(id);
  if (!meeting) notFound();

  const editing = sp.edit === '1';

  return (
    <div className="mx-auto max-w-3xl space-y-4 p-4 md:p-6">
      <div className="text-xs">
        <Link href="/app/coalition/steering" className="text-muted-foreground hover:underline">
          ← Back to meetings
        </Link>
      </div>

      <header className="flex flex-wrap items-baseline justify-between gap-2">
        <div>
          <h1 className="font-serif text-3xl font-bold text-primary">{meeting.title}</h1>
          <p className="text-sm text-muted-foreground">
            Held {fmtDate(meeting.heldOn)} ·{' '}
            {meeting.postedAt ? (
              <span className="text-emerald-700 dark:text-emerald-400">
                Posted {fmtDateTime(meeting.postedAt)}
              </span>
            ) : (
              <span className="text-amber-600 dark:text-amber-400">Draft</span>
            )}
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          {editing ? (
            <Link
              href={`/app/coalition/steering/${meeting.id}`}
              className="inline-flex h-9 items-center rounded-md border border-input bg-card px-3 text-sm hover:bg-muted"
            >
              Cancel
            </Link>
          ) : (
            <Link
              href={`/app/coalition/steering/${meeting.id}?edit=1`}
              className="inline-flex h-9 items-center rounded-md border border-input bg-card px-3 text-sm hover:bg-muted"
            >
              Edit
            </Link>
          )}
          {!meeting.postedAt && !editing ? <SteeringPostButton meetingId={meeting.id} /> : null}
        </div>
      </header>

      {editing ? (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Edit meeting</CardTitle>
          </CardHeader>
          <CardContent>
            <SteeringMeetingForm
              initial={{
                id: meeting.id,
                title: meeting.title,
                heldOn: meeting.heldOn,
                attendees: meeting.attendees,
                agendaMd: meeting.agendaMd,
                decisionsMd: meeting.decisionsMd,
                actionItemsMd: meeting.actionItemsMd,
              }}
            />
          </CardContent>
        </Card>
      ) : (
        <>
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Attendees</CardTitle>
            </CardHeader>
            <CardContent>
              {meeting.attendees.length === 0 ? (
                <p className="text-sm text-muted-foreground">No attendees recorded.</p>
              ) : (
                <ul className="space-y-1 text-sm">
                  {meeting.attendees.map((a) => (
                    <li key={`${a.name}-${a.affiliation ?? ''}`}>
                      <span className="font-medium">{a.name}</span>
                      {a.affiliation ? (
                        <span className="text-muted-foreground"> — {a.affiliation}</span>
                      ) : null}
                    </li>
                  ))}
                </ul>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="text-base">Agenda</CardTitle>
            </CardHeader>
            <CardContent>
              <article className="prose prose-sm max-w-none dark:prose-invert">
                <ReactMarkdown>{meeting.agendaMd || '_(empty)_'}</ReactMarkdown>
              </article>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="text-base">Decisions</CardTitle>
            </CardHeader>
            <CardContent>
              <article className="prose prose-sm max-w-none dark:prose-invert">
                <ReactMarkdown>{meeting.decisionsMd || '_(no decisions recorded)_'}</ReactMarkdown>
              </article>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="text-base">Action items</CardTitle>
            </CardHeader>
            <CardContent>
              <article className="prose prose-sm max-w-none dark:prose-invert">
                <ReactMarkdown>{meeting.actionItemsMd || '_(no action items)_'}</ReactMarkdown>
              </article>
            </CardContent>
          </Card>
        </>
      )}
    </div>
  );
}
