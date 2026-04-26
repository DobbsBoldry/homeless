import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { getTriageOverrideStats, listRecentTriageOverrides } from '@/db/queries/triage-overrides';
import { requireRole } from '@/lib/auth';

export const dynamic = 'force-dynamic';

const fmtTime = (d: Date) =>
  new Intl.DateTimeFormat('en-US', { dateStyle: 'short', timeStyle: 'short' }).format(new Date(d));

const TIER_BADGE: Record<string, string> = {
  high: 'bg-emerald-600/15 text-emerald-700 dark:text-emerald-400',
  medium: 'bg-amber-500/15 text-amber-700 dark:text-amber-400',
  low: 'bg-destructive/15 text-destructive',
};

export default async function TriageOverridesPage() {
  await requireRole(['admin']);
  const [stats, rows] = await Promise.all([
    getTriageOverrideStats(),
    listRecentTriageOverrides(50),
  ]);

  return (
    <div className="mx-auto max-w-5xl space-y-4 p-4 md:p-6">
      <header>
        <h1 className="font-serif text-3xl font-bold text-primary">Triage overrides</h1>
        <p className="text-sm text-muted-foreground">
          Caseworker decisions on the rule-based triage recommendation. Each row is a confirmation
          (chose what the engine recommended) or an override (chose something else, with a reason).
          Overrides are the highest-signal training data for the Phase-2 ML replacement.
        </p>
      </header>

      <div className="grid gap-3 md:grid-cols-3">
        <Card>
          <CardContent>
            <p className="text-xs uppercase tracking-wide text-muted-foreground">
              Decisions logged
            </p>
            <p className="text-3xl font-semibold">{stats.total}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent>
            <p className="text-xs uppercase tracking-wide text-muted-foreground">
              Overrides (chosen ≠ recommended)
            </p>
            <p className="text-3xl font-semibold">{stats.overrides}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent>
            <p className="text-xs uppercase tracking-wide text-muted-foreground">Override rate</p>
            <p className="text-3xl font-semibold">{Math.round(stats.overrideRate * 100)}%</p>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Transitions</CardTitle>
        </CardHeader>
        <CardContent>
          {stats.transitions.length === 0 ? (
            <p className="text-sm text-muted-foreground">
              No decisions logged yet. Caseworkers record decisions on{' '}
              <code className="font-mono">/app/clients/triage</code>.
            </p>
          ) : (
            <ul className="space-y-1 text-sm">
              {stats.transitions.map((t) => (
                <li
                  key={`${t.recommended}->${t.chosen}`}
                  className="flex items-baseline justify-between gap-2"
                >
                  <span>
                    <span
                      className={`rounded px-2 py-0.5 text-xs ${TIER_BADGE[t.recommended] ?? 'bg-muted'}`}
                    >
                      {t.recommended}
                    </span>
                    <span className="mx-2 text-muted-foreground">→</span>
                    <span
                      className={`rounded px-2 py-0.5 text-xs ${TIER_BADGE[t.chosen] ?? 'bg-muted'}`}
                    >
                      {t.chosen}
                    </span>
                    {t.recommended === t.chosen ? (
                      <span className="ml-2 text-xs text-muted-foreground">(confirmed)</span>
                    ) : null}
                  </span>
                  <span className="font-mono text-xs">{t.count}</span>
                </li>
              ))}
            </ul>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Most recent decisions</CardTitle>
        </CardHeader>
        <CardContent>
          {rows.length === 0 ? (
            <p className="text-sm text-muted-foreground">No decisions logged yet.</p>
          ) : (
            <ul className="space-y-2 text-sm">
              {rows.map((r) => {
                const isOverride = r.recommendedTier !== r.chosenTier;
                return (
                  <li key={r.id} className="rounded-md border border-border bg-card p-3 text-xs">
                    <div className="flex flex-wrap items-baseline justify-between gap-2">
                      <span className="font-mono text-muted-foreground">
                        {fmtTime(r.createdAt)} · {r.actorEmail ?? 'unknown'}
                      </span>
                      <span className={isOverride ? 'text-destructive' : 'text-muted-foreground'}>
                        {isOverride ? 'OVERRIDE' : 'confirmed'}
                      </span>
                    </div>
                    <p className="mt-1">
                      Engine recommended{' '}
                      <span className={`rounded px-2 py-0.5 ${TIER_BADGE[r.recommendedTier]}`}>
                        {r.recommendedTier}
                      </span>{' '}
                      (score {r.recommendedScore}) · caseworker chose{' '}
                      <span className={`rounded px-2 py-0.5 ${TIER_BADGE[r.chosenTier]}`}>
                        {r.chosenTier}
                      </span>
                    </p>
                    {r.overrideReason ? (
                      <p className="mt-1 text-muted-foreground italic">"{r.overrideReason}"</p>
                    ) : null}
                  </li>
                );
              })}
            </ul>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
