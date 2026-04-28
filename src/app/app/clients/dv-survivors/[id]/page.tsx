import Link from 'next/link';
import { notFound } from 'next/navigation';
import { requireRole } from '@/lib/auth';
import {
  AbuserBlindDeniedError,
  getSurvivorByIdForViewer,
  listSafetyEventsForSurvivor,
  OasisGateDeniedError,
} from '@/lib/subp';

export const dynamic = 'force-dynamic';

const RISK_BADGE: Record<string, string> = {
  lethality_high: 'bg-red-100 text-red-700 dark:bg-red-900/40 dark:text-red-400',
  lethality_moderate: 'bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-400',
  lethality_low: 'bg-blue-100 text-blue-700 dark:bg-blue-900/40 dark:text-blue-400',
  unknown: 'bg-zinc-100 text-zinc-700 dark:bg-zinc-800 dark:text-zinc-300',
};

const NEEDS_LABELS: Record<string, string> = {
  housing: 'Housing',
  legal: 'Legal',
  childcare: 'Childcare',
  employment: 'Employment',
  mental_health: 'Mental health',
};

export default async function DvSurvivorDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const viewer = await requireRole(['caseworker', 'admin']);
  const { id } = await params;

  // Fetch under abuser-blind + OASIS gate. ADR 0007 § Decision rule 5:
  // 404 indistinguishable from 403 — anti-enumeration. Both deny paths
  // surface as `notFound()` to the client.
  let survivor: Awaited<ReturnType<typeof getSurvivorByIdForViewer>> = null;
  try {
    survivor = await getSurvivorByIdForViewer({ id: viewer.id, role: viewer.role }, id);
  } catch (err) {
    if (err instanceof AbuserBlindDeniedError || err instanceof OasisGateDeniedError) {
      notFound();
    }
    throw err;
  }
  if (!survivor) notFound();

  const events = await listSafetyEventsForSurvivor({ id: viewer.id, role: viewer.role }, id);

  return (
    <div className="mx-auto max-w-3xl space-y-6 p-4 md:p-6">
      <div className="text-xs">
        <Link href="/app/clients/dv-survivors" className="text-muted-foreground hover:underline">
          ← Back to DV survivors
        </Link>
      </div>

      <header className="space-y-2">
        <div className="flex items-center gap-2">
          <h1 className="font-serif text-3xl font-bold text-primary">{survivor.oasisCaseId}</h1>
          <span
            className={`rounded px-1.5 py-0.5 text-[10px] font-medium ${RISK_BADGE[survivor.riskTier] ?? ''}`}
          >
            {survivor.riskTier.replace(/_/g, ' ')}
          </span>
        </div>
        <p className="text-sm text-muted-foreground">
          Enrolled {new Date(survivor.enrolledAt).toISOString().slice(0, 10)} • Status:{' '}
          <strong>{survivor.status}</strong>
        </p>
      </header>

      <section className="space-y-2">
        <h2 className="text-base font-semibold">Safety plan</h2>
        {survivor.safetyPlanOnFile ? (
          <p className="text-sm">
            <span className="text-emerald-700 dark:text-emerald-400">On file.</span>
            {survivor.safetyPlanLastReviewedAt ? (
              <span className="ml-2 text-muted-foreground">
                Last reviewed{' '}
                {new Date(survivor.safetyPlanLastReviewedAt).toISOString().slice(0, 10)}.
              </span>
            ) : (
              <span className="ml-2 text-muted-foreground">Last review date unknown.</span>
            )}
          </p>
        ) : (
          <p className="text-sm text-muted-foreground">
            No safety plan on file. Coordinate with OASIS to confirm intake completion.
          </p>
        )}
        <p className="text-xs text-muted-foreground">
          Plan contents are never persisted in coalition systems (ADR 0007 § 2). The flag and
          last-reviewed date are the only fields shared.
        </p>
      </section>

      <section className="space-y-2">
        <h2 className="text-base font-semibold">Needs assessment</h2>
        <dl className="grid gap-2 sm:grid-cols-2">
          {Object.entries(survivor.needsAssessment).map(([key, val]) => (
            <div key={key} className="flex justify-between border-b border-border py-1 text-sm">
              <dt className="text-muted-foreground">{NEEDS_LABELS[key] ?? key}</dt>
              <dd className="font-medium capitalize">{String(val).replace(/_/g, ' ')}</dd>
            </div>
          ))}
        </dl>
      </section>

      <section className="space-y-3">
        <h2 className="text-base font-semibold">Safety events</h2>
        {events.length === 0 ? (
          <p className="text-sm text-muted-foreground">No events recorded.</p>
        ) : (
          <ol className="space-y-2">
            {events.map((e) => (
              <li
                key={e.id}
                className="rounded-md border border-border bg-muted/10 px-3 py-2 text-sm"
              >
                <div className="flex items-center justify-between">
                  <span className="font-medium capitalize">{e.eventType.replace(/_/g, ' ')}</span>
                  <span className="text-xs text-muted-foreground tabular-nums">
                    {new Date(e.occurredAt).toISOString().slice(0, 10)}
                  </span>
                </div>
                <p className="mt-1 text-xs text-muted-foreground font-mono">{e.summary}</p>
              </li>
            ))}
          </ol>
        )}
        <p className="text-xs text-muted-foreground">
          Events are categorical only — narrative content is not stored (ADR 0007 § 2).
        </p>
      </section>
    </div>
  );
}
