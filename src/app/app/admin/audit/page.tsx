import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { actionCountsByDay, listAuditLog } from '@/db/queries/audit-log';
import { requireRole } from '@/lib/auth';

export const dynamic = 'force-dynamic';

const fmtTime = (d: Date) =>
  new Intl.DateTimeFormat('en-US', { dateStyle: 'short', timeStyle: 'short' }).format(new Date(d));

const WINDOW_DAYS = 7;

export default async function AuditLogPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  await requireRole(['admin']);
  const sp = await searchParams;
  const action = (Array.isArray(sp.action) ? sp.action[0] : sp.action)?.trim() || undefined;
  const targetId = (Array.isArray(sp.targetId) ? sp.targetId[0] : sp.targetId)?.trim() || undefined;

  const [rows, byDay] = await Promise.all([
    listAuditLog({ action, targetId, limit: 200 }),
    actionCountsByDay(WINDOW_DAYS),
  ]);

  const dayMap = new Map<string, number>();
  for (const r of byDay) dayMap.set(r.day, (dayMap.get(r.day) ?? 0) + r.count);
  const days = Array.from(dayMap.entries()).sort(([a], [b]) => a.localeCompare(b));
  const peak = days.reduce((m, [, c]) => Math.max(m, c), 0) || 1;

  // Per-action totals across the window for the right-rail breakdown.
  const actionTotals = new Map<string, number>();
  for (const r of byDay) actionTotals.set(r.action, (actionTotals.get(r.action) ?? 0) + r.count);
  const sortedActions = Array.from(actionTotals.entries()).sort(([, a], [, b]) => b - a);
  const grandTotal = sortedActions.reduce((s, [, c]) => s + c, 0);

  return (
    <div className="mx-auto max-w-6xl space-y-4 p-4 md:p-6">
      <header>
        <h1 className="font-serif text-3xl font-bold text-primary">Audit log</h1>
        <p className="text-sm text-muted-foreground">
          Append-only record of every consent grant, role change, hold, AI generation, and PHI
          access. Last {WINDOW_DAYS} days at a glance; full search below.
        </p>
      </header>

      <div className="grid gap-4 md:grid-cols-3">
        <Card className="md:col-span-2">
          <CardHeader>
            <CardTitle className="text-base">Daily volume</CardTitle>
          </CardHeader>
          <CardContent>
            {days.length === 0 ? (
              <p className="text-sm text-muted-foreground">No events yet.</p>
            ) : (
              <div className="grid grid-cols-7 gap-2">
                {days.map(([day, count]) => (
                  <div key={day} className="text-center">
                    <div className="relative mx-auto h-24 w-8 overflow-hidden rounded bg-muted">
                      <div
                        className="absolute bottom-0 w-full bg-primary"
                        style={{ height: `${(count / peak) * 100}%` }}
                      />
                    </div>
                    <p className="mt-1 text-xs text-muted-foreground">{day.slice(5)}</p>
                    <p className="text-xs font-medium">{count}</p>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">By action</CardTitle>
          </CardHeader>
          <CardContent>
            {sortedActions.length === 0 ? (
              <p className="text-sm text-muted-foreground">No events.</p>
            ) : (
              <ul className="space-y-1 text-xs">
                {sortedActions.slice(0, 12).map(([action, count]) => (
                  <li key={action} className="flex justify-between">
                    <span className="font-mono">{action}</span>
                    <span className="text-muted-foreground">
                      {count}
                      {grandTotal > 0 ? (
                        <span className="ml-1 text-[10px]">
                          ({Math.round((count / grandTotal) * 100)}%)
                        </span>
                      ) : null}
                    </span>
                  </li>
                ))}
              </ul>
            )}
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Search</CardTitle>
        </CardHeader>
        <CardContent>
          <form className="grid gap-2 md:grid-cols-3" action="/app/admin/audit">
            <div className="space-y-1">
              <label htmlFor="action-input" className="text-xs uppercase tracking-wide">
                Action contains
              </label>
              <Input
                id="action-input"
                name="action"
                defaultValue={action ?? ''}
                placeholder="data.accessed, consent, hold"
              />
            </div>
            <div className="space-y-1 md:col-span-2">
              <label htmlFor="target-input" className="text-xs uppercase tracking-wide">
                Target id
              </label>
              <Input
                id="target-input"
                name="targetId"
                defaultValue={targetId ?? ''}
                placeholder="UUID or opaque ref"
              />
            </div>
            <div className="md:col-span-3">
              <button
                type="submit"
                className="rounded-md border border-border bg-card px-3 py-1.5 text-xs hover:bg-muted"
              >
                Apply
              </button>
            </div>
          </form>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">
            Most recent {rows.length === 200 ? `${rows.length}+` : rows.length} events
          </CardTitle>
        </CardHeader>
        <CardContent>
          {rows.length === 0 ? (
            <p className="text-sm text-muted-foreground">
              No events match. Try widening the search.
            </p>
          ) : (
            <ul className="space-y-1 text-xs">
              {rows.map((r) => (
                <li
                  key={r.id}
                  className="flex flex-wrap items-baseline justify-between gap-2 rounded bg-muted/40 px-2 py-1"
                >
                  <span className="font-mono">
                    {fmtTime(r.createdAt)} · <strong>{r.action}</strong>
                    {r.targetTable ? ` · ${r.targetTable}` : ''}
                  </span>
                  <span className="text-muted-foreground">
                    {r.actorEmail ?? <em className="not-italic">system</em>}
                    {r.actorRole ? ` (${r.actorRole})` : ''}
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
