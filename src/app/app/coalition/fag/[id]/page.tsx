import Link from 'next/link';
import { notFound } from 'next/navigation';
import { FagEntryForm } from '@/components/coalition/fag-entry-form';
import { FagMarkPaidButton } from '@/components/coalition/fag-mark-paid-button';
import { FagMemberForm } from '@/components/coalition/fag-member-form';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { getFagMemberById, listEntriesForMember } from '@/db/queries/fag';
import { requireRole } from '@/lib/auth';

export const dynamic = 'force-dynamic';

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

const fmtMoney = (cents: number) =>
  new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    maximumFractionDigits: 2,
  }).format(cents / 100);

const fmtDate = (iso: string) =>
  new Intl.DateTimeFormat('en-US', { dateStyle: 'medium' }).format(new Date(iso));

const fmtTime = (d: Date) =>
  new Intl.DateTimeFormat('en-US', { dateStyle: 'short', timeStyle: 'short' }).format(new Date(d));

export default async function FagMemberDetailPage({ params }: { params: Promise<{ id: string }> }) {
  await requireRole(['admin']);
  const { id } = await params;
  if (!UUID_RE.test(id)) notFound();

  const member = await getFagMemberById(id);
  if (!member) notFound();
  const entries = await listEntriesForMember(id);

  const totalPaid = entries
    .filter((e) => e.status === 'paid')
    .reduce((sum, e) => sum + e.totalCents, 0);
  const totalUnpaid = entries
    .filter((e) => e.status === 'unpaid')
    .reduce((sum, e) => sum + e.totalCents, 0);

  return (
    <div className="mx-auto max-w-3xl space-y-4 p-4 md:p-6">
      <div className="text-xs">
        <Link href="/app/coalition/fag" className="text-muted-foreground hover:underline">
          ← Back to FAG
        </Link>
      </div>

      <header>
        <h1 className="font-serif text-3xl font-bold text-primary">{member.fullName}</h1>
        <p className="text-sm text-muted-foreground">
          {member.role} · status{' '}
          <span
            className={
              member.status === 'active'
                ? 'text-emerald-700 dark:text-emerald-400'
                : 'text-muted-foreground'
            }
          >
            {member.status}
          </span>{' '}
          · {fmtMoney(member.hourlyRateCents)}/hr
        </p>
      </header>

      <div className="grid gap-3 md:grid-cols-2">
        <Card>
          <CardContent>
            <p className="text-xs uppercase tracking-wide text-muted-foreground">Paid to date</p>
            <p className="text-3xl font-semibold">{fmtMoney(totalPaid)}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent>
            <p className="text-xs uppercase tracking-wide text-muted-foreground">Outstanding</p>
            <p className={`text-3xl font-semibold ${totalUnpaid > 0 ? 'text-destructive' : ''}`}>
              {fmtMoney(totalUnpaid)}
            </p>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Add compensation entry</CardTitle>
        </CardHeader>
        <CardContent>
          <FagEntryForm memberId={member.id} defaultRateCents={member.hourlyRateCents} />
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Compensation history ({entries.length})</CardTitle>
        </CardHeader>
        <CardContent>
          {entries.length === 0 ? (
            <p className="text-sm text-muted-foreground">No entries yet.</p>
          ) : (
            <ul className="divide-y divide-border text-sm">
              {entries.map((e) => (
                <li key={e.id} className="space-y-1 py-2">
                  <div className="flex flex-wrap items-baseline justify-between gap-2">
                    <span className="font-medium">{e.description}</span>
                    <span
                      className={`text-xs ${
                        e.status === 'paid'
                          ? 'text-emerald-700 dark:text-emerald-400'
                          : e.status === 'voided'
                            ? 'text-muted-foreground'
                            : 'text-destructive'
                      }`}
                    >
                      {e.status}
                    </span>
                  </div>
                  <p className="text-xs text-muted-foreground">
                    {fmtDate(e.occurredOn)} · {(e.hoursTenths / 10).toFixed(1)}h ×{' '}
                    {fmtMoney(e.hourlyRateCents)}/hr = <strong>{fmtMoney(e.totalCents)}</strong>
                    {e.paidAt ? <> · paid {fmtTime(e.paidAt)}</> : null}
                  </p>
                  {e.notes ? <p className="text-xs italic">"{e.notes}"</p> : null}
                  {e.status === 'unpaid' ? (
                    <div className="pt-1">
                      <FagMarkPaidButton entryId={e.id} />
                    </div>
                  ) : null}
                </li>
              ))}
            </ul>
          )}
        </CardContent>
      </Card>

      <details className="rounded-md border border-border bg-card p-3 text-sm">
        <summary className="cursor-pointer font-medium">Edit advisor details</summary>
        <div className="pt-3">
          <FagMemberForm
            initial={{
              id: member.id,
              fullName: member.fullName,
              role: member.role,
              contactPhone: member.contactPhone,
              contactEmail: member.contactEmail,
              hourlyRateCents: member.hourlyRateCents,
              status: member.status,
              notes: member.notes,
              onboardedOn: member.onboardedOn,
            }}
          />
        </div>
      </details>

      {member.contactPhone || member.contactEmail || member.notes ? (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Contact + notes</CardTitle>
          </CardHeader>
          <CardContent className="space-y-1 text-sm">
            {member.contactPhone ? (
              <p>
                <span className="text-muted-foreground">Phone:</span> {member.contactPhone}
              </p>
            ) : null}
            {member.contactEmail ? (
              <p>
                <span className="text-muted-foreground">Email:</span> {member.contactEmail}
              </p>
            ) : null}
            {member.onboardedOn ? (
              <p>
                <span className="text-muted-foreground">Onboarded:</span>{' '}
                {fmtDate(member.onboardedOn)}
              </p>
            ) : null}
            {member.notes ? (
              <p className="text-xs italic text-muted-foreground">{member.notes}</p>
            ) : null}
          </CardContent>
        </Card>
      ) : null}
    </div>
  );
}
