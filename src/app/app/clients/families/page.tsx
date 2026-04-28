import Link from 'next/link';
import { listChildrenForFamily, listFamilies } from '@/db/queries/families';
import { requireRole } from '@/lib/auth';
import { computeSchoolStabilityRisk, type SchoolStabilityRisk } from '@/lib/subp';

export const dynamic = 'force-dynamic';

const RISK_BADGE: Record<string, string> = {
  critical: 'bg-red-100 text-red-700 dark:bg-red-900/40 dark:text-red-400',
  high: 'bg-orange-100 text-orange-700 dark:bg-orange-900/40 dark:text-orange-400',
  moderate: 'bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-400',
  low: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-400',
};

const RISK_ORDER: Record<string, number> = { critical: 0, high: 1, moderate: 2, low: 3 };

export default async function FamiliesPage() {
  await requireRole(['caseworker', 'admin']);

  const families = await listFamilies({ status: 'any' });

  // For each family, pull its children once and compute the school-
  // stability risk so the list can sort by it. School-changed inference
  // is a per-family rollup: any child whose currentSchoolId differs from
  // the family's receivingSchoolDistrictId counts as a change.
  const enriched = await Promise.all(
    families.map(async (f) => {
      const children = await listChildrenForFamily(f.id);
      const anyMv = children.some((c) => c.enrolledInMckinneyVento.flagged);
      const anyChanged = children.some(
        (c) =>
          c.currentSchoolId !== null &&
          f.receivingSchoolDistrictId !== null &&
          c.currentSchoolId !== f.receivingSchoolDistrictId,
      );
      const risk: SchoolStabilityRisk = computeSchoolStabilityRisk({
        childrenCount: f.childrenCount,
        housingStatus: f.currentHousingStatus,
        schoolOfOriginId: f.receivingSchoolDistrictId,
        currentSchoolId: anyChanged
          ? (children.find((c) => c.currentSchoolId !== f.receivingSchoolDistrictId)
              ?.currentSchoolId ?? null)
          : f.receivingSchoolDistrictId,
        midSchoolYear: true,
        anyChildMckinneyVentoEnrolled: anyMv,
      });
      return { family: f, risk, childCount: children.length };
    }),
  );

  return (
    <div className="mx-auto max-w-5xl space-y-6 p-4 md:p-6">
      <div className="text-xs">
        <Link href="/app/clients" className="text-muted-foreground hover:underline">
          ← Back to clients
        </Link>
      </div>
      <header>
        <h1 className="font-serif text-3xl font-bold text-primary">Families w/ children</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Families in the coalition pipeline, ranked by school-stability risk. Builds on{' '}
          <Link
            href="/agreements/ferpa/template"
            className="underline underline-offset-2 hover:text-foreground"
          >
            FERPA-fork
          </Link>{' '}
          (ADR 0005) and McKinney-Vento data flowing through PRVN-003. Synthetic data only until BAA
          closes.
        </p>
      </header>

      {enriched.length === 0 ? (
        <div className="rounded-md border border-border bg-muted/20 p-6 text-sm">
          <p className="font-semibold">No families on file.</p>
          <p className="mt-2 text-muted-foreground">
            Run <code className="font-mono">pnpm tsx scripts/gen-synthetic-families.ts</code> to
            seed synthetic data, or wait for entries from eviction / ED / school-referral pipelines.
          </p>
        </div>
      ) : (
        <div className="overflow-x-auto rounded-md border border-border">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b bg-muted/30 text-left">
                <th className="px-3 py-2 font-medium">Family</th>
                <th className="px-3 py-2 font-medium">Stability risk</th>
                <th className="px-3 py-2 font-medium">Children</th>
                <th className="px-3 py-2 font-medium">Housing</th>
                <th className="px-3 py-2 font-medium">Entry</th>
              </tr>
            </thead>
            <tbody>
              {[...enriched]
                .sort((a, b) => {
                  const r = (RISK_ORDER[a.risk.risk] ?? 9) - (RISK_ORDER[b.risk.risk] ?? 9);
                  if (r !== 0) return r;
                  return (
                    new Date(b.family.createdAt).getTime() - new Date(a.family.createdAt).getTime()
                  );
                })
                .map(({ family: f, risk, childCount }) => (
                  <tr key={f.id} className="border-b last:border-0 hover:bg-muted/10">
                    <td className="px-3 py-2">
                      <Link
                        href={`/app/clients/families/${f.id}`}
                        className="font-medium hover:underline"
                      >
                        {f.primaryCaregiverName}
                      </Link>
                      <div className="text-[10px] text-muted-foreground">
                        household {f.householdSize}
                      </div>
                    </td>
                    <td className="px-3 py-2">
                      <span
                        className={`rounded px-1.5 py-0.5 text-[10px] font-medium ${RISK_BADGE[risk.risk] ?? ''}`}
                      >
                        {risk.risk}
                      </span>
                    </td>
                    <td className="px-3 py-2 tabular-nums">{childCount}</td>
                    <td className="px-3 py-2 capitalize">
                      {f.currentHousingStatus.replace(/_/g, ' ')}
                    </td>
                    <td className="px-3 py-2 capitalize">{f.entrySignal.replace(/_/g, ' ')}</td>
                  </tr>
                ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
