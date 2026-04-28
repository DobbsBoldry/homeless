import { eq } from 'drizzle-orm';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { db } from '@/db/client';
import { getFamily, listChildrenForFamily } from '@/db/queries/families';
import { partnerOrgs } from '@/db/schema/partner-orgs';
import { requireRole } from '@/lib/auth';
import { computeSchoolStabilityRisk } from '@/lib/subp';

export const dynamic = 'force-dynamic';

const RISK_BADGE: Record<string, string> = {
  critical: 'bg-red-100 text-red-700 dark:bg-red-900/40 dark:text-red-400',
  high: 'bg-orange-100 text-orange-700 dark:bg-orange-900/40 dark:text-orange-400',
  moderate: 'bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-400',
  low: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-400',
};

const HOUSING_LABEL: Record<string, string> = {
  stably_housed: 'Stably housed',
  doubled_up: 'Doubled up',
  shelter: 'Shelter',
  unsheltered: 'Unsheltered',
  hotel: 'Hotel / motel',
};

export default async function FamilyDetailPage({ params }: { params: Promise<{ id: string }> }) {
  await requireRole(['caseworker', 'admin']);
  const { id } = await params;

  const family = await getFamily(id);
  if (!family) notFound();

  const children = await listChildrenForFamily(family.id);

  const schoolIds = new Set<string>();
  if (family.receivingSchoolDistrictId) schoolIds.add(family.receivingSchoolDistrictId);
  for (const c of children) if (c.currentSchoolId) schoolIds.add(c.currentSchoolId);

  const schools =
    schoolIds.size === 0
      ? []
      : await Promise.all(
          [...schoolIds].map((sid) =>
            db
              .select({ id: partnerOrgs.id, name: partnerOrgs.name })
              .from(partnerOrgs)
              .where(eq(partnerOrgs.id, sid))
              .limit(1)
              .then((r) => r[0]),
          ),
        );
  const schoolNameById = new Map<string, string>();
  for (const s of schools) if (s) schoolNameById.set(s.id, s.name);

  const anyMv = children.some((c) => c.enrolledInMckinneyVento.flagged);
  const changedChild = children.find(
    (c) =>
      c.currentSchoolId !== null &&
      family.receivingSchoolDistrictId !== null &&
      c.currentSchoolId !== family.receivingSchoolDistrictId,
  );
  const risk = computeSchoolStabilityRisk({
    childrenCount: family.childrenCount,
    housingStatus: family.currentHousingStatus,
    schoolOfOriginId: family.receivingSchoolDistrictId,
    currentSchoolId: changedChild?.currentSchoolId ?? family.receivingSchoolDistrictId,
    midSchoolYear: true,
    anyChildMckinneyVentoEnrolled: anyMv,
  });

  return (
    <div className="mx-auto max-w-3xl space-y-6 p-4 md:p-6">
      <div className="text-xs">
        <Link href="/app/clients/families" className="text-muted-foreground hover:underline">
          ← Back to families
        </Link>
      </div>

      <header className="space-y-2">
        <div className="flex items-center gap-2">
          <h1 className="font-serif text-3xl font-bold text-primary">
            {family.primaryCaregiverName}
          </h1>
          <span
            className={`rounded px-1.5 py-0.5 text-[10px] font-medium ${RISK_BADGE[risk.risk] ?? ''}`}
          >
            {risk.risk}
          </span>
        </div>
        <p className="text-sm text-muted-foreground">
          Household size {family.householdSize} • {family.childrenCount} child
          {family.childrenCount === 1 ? '' : 'ren'} • Entry:{' '}
          <span className="capitalize">{family.entrySignal.replace(/_/g, ' ')}</span>
        </p>
      </header>

      <section className="space-y-2">
        <h2 className="text-base font-semibold">School-stability risk</h2>
        <p className="text-sm">
          <span
            className={`rounded px-1.5 py-0.5 text-[10px] font-medium ${RISK_BADGE[risk.risk]}`}
          >
            {risk.risk}
          </span>
        </p>
        {risk.reasons.length > 0 && (
          <ul className="list-disc pl-6 text-sm text-muted-foreground">
            {risk.reasons.map((r) => (
              <li key={r}>{r.replace(/_/g, ' ')}</li>
            ))}
          </ul>
        )}
      </section>

      <section className="space-y-2">
        <h2 className="text-base font-semibold">Housing</h2>
        <p className="text-sm">
          <strong>{HOUSING_LABEL[family.currentHousingStatus]}</strong>
        </p>
        {family.receivingSchoolDistrictId && (
          <p className="text-xs text-muted-foreground">
            School-of-origin (per McKinney-Vento):{' '}
            {schoolNameById.get(family.receivingSchoolDistrictId) ?? '—'}
          </p>
        )}
      </section>

      <section className="space-y-3">
        <h2 className="text-base font-semibold">Children</h2>
        {children.length === 0 ? (
          <p className="text-sm text-muted-foreground">No children recorded.</p>
        ) : (
          <ol className="space-y-2">
            {children.map((c) => (
              <li
                key={c.id}
                className="rounded-md border border-border bg-muted/10 px-3 py-2 text-sm"
              >
                <div className="flex items-center justify-between">
                  <span className="font-medium font-mono text-xs">{c.childRef}</span>
                  <span className="text-xs text-muted-foreground capitalize">
                    {c.gradeBand.replace(/_/g, ' ')}
                  </span>
                </div>
                <div className="mt-1 text-xs text-muted-foreground">
                  Current school:{' '}
                  {c.currentSchoolId ? (schoolNameById.get(c.currentSchoolId) ?? '—') : 'none'}
                  {' • '}
                  McKinney-Vento:{' '}
                  {c.enrolledInMckinneyVento.flagged ? (
                    <span className="text-emerald-700 dark:text-emerald-400">flagged</span>
                  ) : (
                    'not flagged'
                  )}
                </div>
              </li>
            ))}
          </ol>
        )}
      </section>
    </div>
  );
}
