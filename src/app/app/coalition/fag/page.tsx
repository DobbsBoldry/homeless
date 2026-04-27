import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { getFagAggregates, listFagMemberSummaries } from '@/db/queries/fag';
import { requireRole } from '@/lib/auth';

export const dynamic = 'force-dynamic';

const fmtMoney = (cents: number) =>
  new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    maximumFractionDigits: 0,
  }).format(cents / 100);

export default async function FagPage() {
  await requireRole(['admin']);
  const [summaries, totals] = await Promise.all([listFagMemberSummaries(), getFagAggregates()]);

  return (
    <div className="mx-auto max-w-4xl space-y-4 p-4 md:p-6">
      <header className="flex flex-wrap items-baseline justify-between gap-2">
        <div>
          <h1 className="font-serif text-3xl font-bold text-primary">Frontline Advisory Group</h1>
          <p className="text-sm text-muted-foreground">
            Lived-experience advisors who get paid for their time. Roster, hours, and payout status.
          </p>
        </div>
        <Link href="/app/coalition/fag/new">
          <Button>Add advisor</Button>
        </Link>
      </header>

      <div className="grid gap-3 md:grid-cols-3">
        <Card>
          <CardContent>
            <p className="text-xs uppercase tracking-wide text-muted-foreground">Active advisors</p>
            <p className="text-3xl font-semibold">{totals.activeMemberCount}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent>
            <p className="text-xs uppercase tracking-wide text-muted-foreground">Paid to date</p>
            <p className="text-3xl font-semibold">{fmtMoney(totals.totalPaidCents)}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent>
            <p className="text-xs uppercase tracking-wide text-muted-foreground">Outstanding</p>
            <p
              className={`text-3xl font-semibold ${totals.totalUnpaidCents > 0 ? 'text-destructive' : ''}`}
            >
              {fmtMoney(totals.totalUnpaidCents)}
            </p>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Roster</CardTitle>
        </CardHeader>
        <CardContent>
          {summaries.length === 0 ? (
            <p className="text-sm text-muted-foreground">
              No advisors yet. Click <strong>Add advisor</strong> to start.
            </p>
          ) : (
            <ul className="divide-y divide-border text-sm">
              {summaries.map((s) => (
                <li
                  key={s.member.id}
                  className="flex flex-wrap items-baseline justify-between gap-2 py-2"
                >
                  <Link
                    href={`/app/coalition/fag/${s.member.id}`}
                    className="font-medium hover:underline"
                  >
                    {s.member.fullName}
                  </Link>
                  <span className="text-xs text-muted-foreground">
                    {s.member.role} ·{' '}
                    <span
                      className={
                        s.member.status === 'active'
                          ? 'text-emerald-700 dark:text-emerald-400'
                          : 'text-muted-foreground'
                      }
                    >
                      {s.member.status}
                    </span>{' '}
                    · {s.entryCount} entr{s.entryCount === 1 ? 'y' : 'ies'} ·{' '}
                    {s.unpaidCents > 0 ? (
                      <span className="text-destructive">{fmtMoney(s.unpaidCents)} owed</span>
                    ) : (
                      <span>all paid</span>
                    )}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </CardContent>
      </Card>

      <Card className="border-amber-500/40 bg-amber-500/5">
        <CardContent className="text-xs text-muted-foreground">
          <strong>Pay at the time of the session, not after.</strong> Coalition policy. Backed-up
          payouts are how advisors lose trust in the FAG.
        </CardContent>
      </Card>
    </div>
  );
}
