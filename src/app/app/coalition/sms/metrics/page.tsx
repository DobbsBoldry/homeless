import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import {
  dailyIntentCounts,
  intentTotals,
  recentRedactedMessages,
  uniqueCallerCount,
} from '@/db/queries/sms-metrics';
import { requireRole } from '@/lib/auth';

export const dynamic = 'force-dynamic';

const WINDOW_DAYS = 7;

const fmtTime = (d: Date) =>
  new Intl.DateTimeFormat('en-US', { dateStyle: 'short', timeStyle: 'short' }).format(new Date(d));

/**
 * INTENT_LABELS keeps the dashboard copy stable even as the pipeline
 * evolves; unknown intents fall through to their raw key so we can
 * still see them in the breakdown.
 */
const INTENT_LABELS: Record<string, string> = {
  bed_results: 'Bed list shown',
  awaiting_location: 'Asked for location',
  location_received: 'Location received → results',
  help: 'HELP',
  food: 'FOOD',
  story: 'STORY',
  stop: 'STOP / opt-out',
  hold_confirmed: 'Hold confirmed',
  hold_failed: 'Hold failed',
  release_confirmed: 'Hold released',
  release_failed: 'Release failed',
  unknown: 'Unknown / didn\u2019t match',
  error: 'Pipeline error',
};

export default async function SmsMetricsPage() {
  await requireRole(['admin']);

  const [byDay, totals, callers, recent] = await Promise.all([
    dailyIntentCounts(WINDOW_DAYS),
    intentTotals(WINDOW_DAYS),
    uniqueCallerCount(WINDOW_DAYS),
    recentRedactedMessages(20),
  ]);

  const totalMessages = totals.reduce((sum, t) => sum + t.count, 0);
  const beds = totals.find((t) => t.intent === 'bed_results')?.count ?? 0;
  const askedLocation = totals.find((t) => t.intent === 'awaiting_location')?.count ?? 0;
  const locationReplies = totals.find((t) => t.intent === 'location_received')?.count ?? 0;
  const completionRate =
    askedLocation > 0 ? Math.round((locationReplies / askedLocation) * 100) : null;
  const unknown = totals.find((t) => t.intent === 'unknown')?.count ?? 0;

  // Build a per-day stack: array of { day, total, byIntent: { intent: count } }
  const dayMap = new Map<string, Map<string, number>>();
  for (const r of byDay) {
    if (!dayMap.has(r.day)) dayMap.set(r.day, new Map());
    dayMap.get(r.day)!.set(r.intent, r.count);
  }
  const days = Array.from(dayMap.entries())
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([day, intents]) => ({
      day,
      total: Array.from(intents.values()).reduce((s, n) => s + n, 0),
      intents: Array.from(intents.entries()).map(([k, v]) => ({ intent: k, count: v })),
    }));
  const peakDayCount = days.reduce((m, d) => Math.max(m, d.total), 0) || 1;

  return (
    <div className="mx-auto max-w-6xl space-y-4 p-4 md:p-6">
      <header>
        <h1 className="font-serif text-3xl font-bold text-primary">SMS bed-finder metrics</h1>
        <p className="text-sm text-muted-foreground">
          Last {WINDOW_DAYS} days. Phone numbers never leave the database — only counts do.
          Simulated playground traffic is excluded.
        </p>
      </header>

      <div className="grid gap-4 md:grid-cols-4">
        <Card>
          <CardContent>
            <p className="text-xs uppercase tracking-wide text-muted-foreground">Messages</p>
            <p className="text-3xl font-semibold">{totalMessages}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent>
            <p className="text-xs uppercase tracking-wide text-muted-foreground">Unique callers</p>
            <p className="text-3xl font-semibold">{callers}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent>
            <p className="text-xs uppercase tracking-wide text-muted-foreground">Bed lists shown</p>
            <p className="text-3xl font-semibold">{beds + locationReplies}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent>
            <p className="text-xs uppercase tracking-wide text-muted-foreground">
              Location-prompt completion
            </p>
            <p className="text-3xl font-semibold">
              {completionRate === null ? '—' : `${completionRate}%`}
            </p>
            <p className="text-xs text-muted-foreground">
              {locationReplies} of {askedLocation} prompts answered
            </p>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Daily volume</CardTitle>
        </CardHeader>
        <CardContent>
          {days.length === 0 ? (
            <p className="text-sm text-muted-foreground">No traffic in the window.</p>
          ) : (
            <div className="grid grid-cols-7 gap-2">
              {days.map((d) => (
                <div key={d.day} className="text-center">
                  <div
                    role="img"
                    aria-label={`${d.total} messages on ${d.day}`}
                    className="relative mx-auto h-32 w-8 overflow-hidden rounded bg-muted"
                  >
                    <div
                      className="absolute bottom-0 w-full bg-primary"
                      style={{ height: `${(d.total / peakDayCount) * 100}%` }}
                    />
                  </div>
                  <p className="mt-1 text-xs text-muted-foreground">{d.day.slice(5)}</p>
                  <p className="text-xs font-medium">{d.total}</p>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Intent breakdown</CardTitle>
        </CardHeader>
        <CardContent>
          {totals.length === 0 ? (
            <p className="text-sm text-muted-foreground">No traffic in the window.</p>
          ) : (
            <ul className="space-y-2">
              {totals.map((t) => {
                const pct = totalMessages > 0 ? (t.count / totalMessages) * 100 : 0;
                return (
                  <li key={t.intent} className="text-sm">
                    <div className="flex justify-between">
                      <span>{INTENT_LABELS[t.intent] ?? t.intent}</span>
                      <span className="text-muted-foreground">
                        {t.count} <span className="text-xs">({Math.round(pct)}%)</span>
                      </span>
                    </div>
                    <div className="mt-1 h-1.5 w-full overflow-hidden rounded-full bg-muted">
                      <div className="h-full bg-primary" style={{ width: `${Math.round(pct)}%` }} />
                    </div>
                  </li>
                );
              })}
            </ul>
          )}
          {unknown > 0 ? (
            <p className="mt-3 rounded-md border border-amber-500/40 bg-amber-500/5 p-2 text-xs">
              <strong>Friction signal:</strong> {unknown} unknown messages in the window —
              candidates for parser additions or improved help copy.
            </p>
          ) : null}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Recent traffic (redacted)</CardTitle>
        </CardHeader>
        <CardContent>
          {recent.length === 0 ? (
            <p className="text-sm text-muted-foreground">No messages yet.</p>
          ) : (
            <ul className="space-y-1 text-xs">
              {recent.map((m) => (
                <li
                  key={m.id}
                  className="flex flex-wrap items-baseline justify-between gap-2 rounded bg-muted/40 px-2 py-1"
                >
                  <span className="font-mono text-muted-foreground">
                    {fmtTime(m.receivedAt)} · …{m.fromLast4} · {m.intent}
                  </span>
                  <span className="truncate font-mono">{m.bodyExcerpt}</span>
                </li>
              ))}
            </ul>
          )}
          <p className="mt-3 text-xs text-muted-foreground">
            Phone numbers shown only as last-4 digits. Full numbers stay in the
            <code className="font-mono"> sms_messages</code> table for audit; this view is for fast
            triage.
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
