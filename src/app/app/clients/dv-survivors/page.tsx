import { eq } from 'drizzle-orm';
import Link from 'next/link';
import { db } from '@/db/client';
import { partnerOrgs } from '@/db/schema/partner-orgs';
import { requireRole } from '@/lib/auth';
import { listSurvivorsForViewer, OasisGateDeniedError } from '@/lib/subp';

export const dynamic = 'force-dynamic';

const RISK_BADGE: Record<string, string> = {
  lethality_high: 'bg-red-100 text-red-700 dark:bg-red-900/40 dark:text-red-400',
  lethality_moderate: 'bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-400',
  lethality_low: 'bg-blue-100 text-blue-700 dark:bg-blue-900/40 dark:text-blue-400',
  unknown: 'bg-zinc-100 text-zinc-700 dark:bg-zinc-800 dark:text-zinc-300',
};

const STATUS_BADGE: Record<string, string> = {
  active: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-400',
  exited: 'bg-zinc-100 text-zinc-600 dark:bg-zinc-800 dark:text-zinc-400',
  transferred: 'bg-purple-100 text-purple-700 dark:bg-purple-900/40 dark:text-purple-400',
  deceased: 'bg-zinc-200 text-zinc-700 dark:bg-zinc-800 dark:text-zinc-300',
};

const RISK_ORDER: Record<string, number> = {
  lethality_high: 0,
  lethality_moderate: 1,
  lethality_low: 2,
  unknown: 3,
};

export default async function DvSurvivorsPage() {
  const viewer = await requireRole(['caseworker', 'admin']);

  // Resolve OASIS partner_org by slug. Multiple shelters may exist; v1
  // surfaces only the canonical OASIS partner. (If a future amendment
  // pairs a second OASIS branch, generalize this lookup.)
  const [oasis] = await db
    .select({ id: partnerOrgs.id, name: partnerOrgs.name })
    .from(partnerOrgs)
    .where(eq(partnerOrgs.slug, 'oasis-shelter'))
    .limit(1);

  if (!oasis) {
    return (
      <div className="mx-auto max-w-3xl space-y-4 p-4 md:p-6">
        <div className="text-xs">
          <Link href="/app/clients" className="text-muted-foreground hover:underline">
            ← Back to clients
          </Link>
        </div>
        <header>
          <h1 className="font-serif text-3xl font-bold text-primary">DV survivors</h1>
        </header>
        <div className="rounded-md border border-border bg-muted/20 p-6 text-sm">
          <p className="font-semibold">OASIS partner not found.</p>
          <p className="mt-2 text-muted-foreground">
            The OASIS partner org (slug=<code className="font-mono">oasis-shelter</code>) is not in
            the directory. Run base seed first, then{' '}
            <code className="font-mono">pnpm tsx scripts/gen-synthetic-dv-survivors.ts</code>.
          </p>
        </div>
      </div>
    );
  }

  let rows: Awaited<ReturnType<typeof listSurvivorsForViewer>> = [];
  let gateError: string | null = null;
  try {
    rows = await listSurvivorsForViewer({ id: viewer.id, role: viewer.role }, oasis.id);
  } catch (err) {
    if (err instanceof OasisGateDeniedError) {
      gateError = err.message;
    } else {
      throw err;
    }
  }

  return (
    <div className="mx-auto max-w-5xl space-y-6 p-4 md:p-6">
      <div className="text-xs">
        <Link href="/app/clients" className="text-muted-foreground hover:underline">
          ← Back to clients
        </Link>
      </div>
      <header>
        <h1 className="font-serif text-3xl font-bold text-primary">DV survivors</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Survivors enrolled with{' '}
          <Link
            href="/agreements/oasis/template"
            className="underline underline-offset-2 hover:text-foreground"
          >
            OASIS
          </Link>{' '}
          under an active data-sharing agreement. Per <strong>ADR 0007</strong>, abuser-blind
          discipline is enforced at the contract layer: location-identifying fields are not stored
          here. Caseworkers see only their own assignments; admins see all. Synthetic data only
          until OASIS DSA closes for real.
        </p>
      </header>

      {gateError ? (
        <div className="rounded-md border border-amber-500/40 bg-amber-500/5 p-4 text-sm">
          <p className="font-semibold text-amber-700 dark:text-amber-400">
            OASIS data-sharing agreement not active.
          </p>
          <p className="mt-1 text-muted-foreground">{gateError}</p>
        </div>
      ) : rows.length === 0 ? (
        <div className="rounded-md border border-border bg-muted/20 p-6 text-sm">
          <p className="font-semibold">
            {viewer.role === 'admin'
              ? 'No survivor records on file.'
              : 'No survivors are currently assigned to you.'}
          </p>
          <p className="mt-2 text-muted-foreground">
            {viewer.role === 'admin' ? (
              <>
                Run{' '}
                <code className="font-mono">pnpm tsx scripts/gen-synthetic-dv-survivors.ts</code> to
                seed synthetic data, or wait for the OASIS feed (post-integration).
              </>
            ) : (
              'Admin assigns survivors to advocates. If you expected a record here, contact your admin.'
            )}
          </p>
        </div>
      ) : (
        (() => {
          const sorted = [...rows].sort((a, b) => {
            const r = (RISK_ORDER[a.riskTier] ?? 9) - (RISK_ORDER[b.riskTier] ?? 9);
            if (r !== 0) return r;
            return new Date(b.enrolledAt).getTime() - new Date(a.enrolledAt).getTime();
          });
          return (
            <>
              {/* Desktop: table. Mobile: card stack (no horizontal scroll). */}
              <div className="hidden overflow-x-auto rounded-md border border-border md:block">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b bg-muted/30 text-left">
                      <th className="px-3 py-2 font-medium">Case</th>
                      <th className="px-3 py-2 font-medium">Risk tier</th>
                      <th className="px-3 py-2 font-medium">Status</th>
                      <th className="px-3 py-2 font-medium">Enrolled</th>
                      <th className="px-3 py-2 font-medium">Safety plan</th>
                    </tr>
                  </thead>
                  <tbody>
                    {sorted.map((s) => (
                      <tr key={s.id} className="border-b last:border-0 hover:bg-muted/10">
                        <td className="px-3 py-2">
                          <Link
                            href={`/app/clients/dv-survivors/${s.id}`}
                            className="font-medium hover:underline"
                          >
                            {s.oasisCaseId}
                          </Link>
                        </td>
                        <td className="px-3 py-2">
                          <span
                            className={`rounded px-1.5 py-0.5 text-[10px] font-medium ${RISK_BADGE[s.riskTier] ?? ''}`}
                          >
                            {s.riskTier.replace(/_/g, ' ')}
                          </span>
                        </td>
                        <td className="px-3 py-2">
                          <span
                            className={`rounded px-1.5 py-0.5 text-[10px] font-medium ${STATUS_BADGE[s.status] ?? ''}`}
                          >
                            {s.status}
                          </span>
                        </td>
                        <td className="px-3 py-2 tabular-nums text-xs text-muted-foreground">
                          {new Date(s.enrolledAt).toISOString().slice(0, 10)}
                        </td>
                        <td className="px-3 py-2">
                          {s.safetyPlanOnFile ? (
                            <span className="text-emerald-700 dark:text-emerald-400">on file</span>
                          ) : (
                            <span className="text-muted-foreground">none</span>
                          )}
                          {s.safetyPlanLastReviewedAt && (
                            <span className="ml-1 text-[10px] text-muted-foreground">
                              (rev {new Date(s.safetyPlanLastReviewedAt).toISOString().slice(0, 10)}
                              )
                            </span>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <ul className="space-y-2 md:hidden">
                {sorted.map((s) => (
                  <li key={s.id} className="rounded-md border border-border bg-card p-3 text-sm">
                    <div className="flex items-start justify-between gap-2">
                      <Link
                        href={`/app/clients/dv-survivors/${s.id}`}
                        className="font-medium hover:underline"
                      >
                        {s.oasisCaseId}
                      </Link>
                      <span
                        className={`shrink-0 rounded px-1.5 py-0.5 text-[10px] font-medium ${RISK_BADGE[s.riskTier] ?? ''}`}
                      >
                        {s.riskTier.replace(/_/g, ' ')}
                      </span>
                    </div>
                    <dl className="mt-2 grid grid-cols-2 gap-x-3 gap-y-1 text-xs text-muted-foreground">
                      <div>
                        <dt className="inline font-medium">Status: </dt>
                        <dd className="inline">{s.status}</dd>
                      </div>
                      <div>
                        <dt className="inline font-medium">Enrolled: </dt>
                        <dd className="inline tabular-nums">
                          {new Date(s.enrolledAt).toISOString().slice(0, 10)}
                        </dd>
                      </div>
                      <div className="col-span-2">
                        <dt className="inline font-medium">Safety plan: </dt>
                        <dd className="inline">{s.safetyPlanOnFile ? 'on file' : 'none'}</dd>
                      </div>
                    </dl>
                  </li>
                ))}
              </ul>
            </>
          );
        })()
      )}
    </div>
  );
}
