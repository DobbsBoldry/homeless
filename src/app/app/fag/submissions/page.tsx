import { getActiveFagMemberForUser, listFeedbackForMember } from '@/db/queries/fag';
import { requireUser } from '@/lib/auth';
import { FAG_FEEDBACK_CATEGORY_LABELS } from '@/lib/cwt';

export const dynamic = 'force-dynamic';

const fmt = (d: Date) =>
  new Intl.DateTimeFormat('en-US', { dateStyle: 'medium', timeStyle: 'short' }).format(new Date(d));

export default async function FagSubmissionsPage() {
  const user = await requireUser();
  const member = await getActiveFagMemberForUser(user.id);

  if (!member) {
    return (
      <div className="mx-auto max-w-2xl space-y-2 p-6">
        <h1 className="font-serif text-2xl font-bold text-primary">My feedback</h1>
        <p className="rounded-md border border-border bg-card p-4 text-sm text-muted-foreground">
          This page is for active Frontline Advisory Group members. If you believe you should have
          access, contact a coalition admin.
        </p>
      </div>
    );
  }

  const submissions = await listFeedbackForMember(member.id);

  return (
    <div className="mx-auto max-w-2xl space-y-4 p-6">
      <header>
        <h1 className="font-serif text-2xl font-bold text-primary">My feedback</h1>
        <p className="text-sm text-muted-foreground">
          The advisory feedback you've submitted while using the tool.
        </p>
      </header>

      {submissions.length === 0 ? (
        <p className="rounded-md border border-border bg-card p-4 text-sm text-muted-foreground">
          You haven't submitted any feedback yet. Use the "Give feedback" button on any page.
        </p>
      ) : (
        <ul className="space-y-2">
          {submissions.map((s) => (
            <li key={s.id} className="rounded-md border border-border bg-card p-3 text-sm">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <span className="font-medium">
                  {'★'.repeat(s.rating)}
                  <span className="text-muted-foreground/40">{'★'.repeat(5 - s.rating)}</span>
                </span>
                <span className="text-xs text-muted-foreground">{fmt(s.createdAt)}</span>
              </div>
              <p className="mt-1 text-xs text-muted-foreground">
                {FAG_FEEDBACK_CATEGORY_LABELS[s.category]} · <code>{s.route}</code>
              </p>
              {s.comment ? <p className="mt-2 whitespace-pre-wrap">{s.comment}</p> : null}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
