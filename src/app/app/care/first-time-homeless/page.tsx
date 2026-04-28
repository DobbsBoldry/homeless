import Link from 'next/link';
import { listFirstTimeHomelessAlerts } from '@/db/queries/ed-encounters';
import { requireRole } from '@/lib/auth';

export const dynamic = 'force-dynamic';

const HOURS_RECENT_THRESHOLD = 48;

export default async function FirstTimeHomelessAlertsPage() {
  await requireRole(['ed_coordinator', 'admin']);

  const alerts = await listFirstTimeHomelessAlerts({ windowDays: 90 });
  const now = Date.now();

  return (
    <div className="mx-auto max-w-5xl space-y-6 p-4 md:p-6">
      <div className="text-xs">
        <Link href="/app/care/queue" className="text-muted-foreground hover:underline">
          ← Back to care queue
        </Link>
      </div>
      <header>
        <h1 className="font-serif text-3xl font-bold text-primary">First-time-homeless alerts</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Patients whose most recent ED encounter is their first transition to{' '}
          <code className="font-mono text-xs">shelter</code> or{' '}
          <code className="font-mono text-xs">unsheltered</code> housing on coalition record. The
          alert window is the discharge moment — coordinate outreach before the patient leaves the
          ED. Patients with a single homeless encounter (no prior history) are excluded; chronic
          super-utilizers belong on the{' '}
          <Link
            href="/app/care/queue"
            className="underline underline-offset-2 hover:text-foreground"
          >
            super-utilizer queue
          </Link>
          .
        </p>
      </header>

      {alerts.length === 0 ? (
        <div className="rounded-md border border-border bg-muted/20 p-6 text-sm">
          <p className="font-semibold">No first-time-homeless alerts in the last 90 days.</p>
          <p className="mt-2 text-muted-foreground">
            This is the synthetic-default state for a freshly-seeded fixture without a transition
            pattern. Run{' '}
            <code className="font-mono">pnpm tsx scripts/gen-synthetic-ed-encounters.ts</code> to
            seed a richer signal.
          </p>
        </div>
      ) : (
        <div className="overflow-x-auto rounded-md border border-border">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b bg-muted/30 text-left">
                <th className="px-3 py-2 font-medium">Patient</th>
                <th className="px-3 py-2 font-medium">Transition</th>
                <th className="px-3 py-2 font-medium">Prior visits</th>
                <th className="px-3 py-2 font-medium">Disposition</th>
                <th className="px-3 py-2 font-medium">Chief complaint</th>
              </tr>
            </thead>
            <tbody>
              {alerts.map((a) => {
                const transitionAt = a.classification.transitionAt;
                const ageHours = transitionAt
                  ? (now - transitionAt.getTime()) / (1000 * 60 * 60)
                  : null;
                const isRecent = ageHours !== null && ageHours < HOURS_RECENT_THRESHOLD;
                return (
                  <tr key={a.patientId} className="border-b last:border-0 hover:bg-muted/10">
                    <td className="px-3 py-2 font-mono text-xs">
                      <Link href={`/app/care/patients/${a.patientId}`} className="hover:underline">
                        {a.patientId}
                      </Link>
                    </td>
                    <td className="px-3 py-2 tabular-nums">
                      {transitionAt ? transitionAt.toISOString().slice(0, 10) : '—'}
                      {isRecent && (
                        <span className="ml-2 rounded bg-red-100 px-1.5 py-0.5 text-[10px] font-medium text-red-700 dark:bg-red-900/40 dark:text-red-400">
                          ≤{HOURS_RECENT_THRESHOLD}h
                        </span>
                      )}
                    </td>
                    <td className="px-3 py-2 tabular-nums">{a.classification.encountersBefore}</td>
                    <td className="px-3 py-2 capitalize">{a.lastDisposition}</td>
                    <td className="px-3 py-2 max-w-md truncate" title={a.lastChiefComplaint}>
                      {a.lastChiefComplaint}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      <div className="rounded-md border border-amber-500/40 bg-amber-500/5 p-3 text-xs">
        <p className="font-medium">PHI fence still in effect.</p>
        <p className="mt-1 text-muted-foreground">
          Patient identifiers are opaque (synthetic <code className="font-mono">SYN-PAT-…</code>{' '}
          prefix today, hashed Epic ids post-BAA). The alert engine reads housing-status transitions
          only — no clinical free-text. Real-time discharge alerting to OH social workers is a
          follow-up; today this is a read-only triage view for the coalition's ED coordinator.
        </p>
      </div>
    </div>
  );
}
