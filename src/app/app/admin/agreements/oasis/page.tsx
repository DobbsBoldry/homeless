import { eq } from 'drizzle-orm';
import Link from 'next/link';
import { OasisDsaAgreementForm } from '@/components/dtrs/oasis-dsa-agreement-form';
import { db } from '@/db/client';
import { getActiveOasisDsa, listAgreementsForPartner } from '@/db/queries/partner-agreements';
import { partnerOrgs } from '@/db/schema/partner-orgs';
import { requireRole } from '@/lib/auth';

export const dynamic = 'force-dynamic';

export default async function OasisAgreementsPage() {
  await requireRole(['admin']);

  // OASIS is type='shelter' in the seeded directory. The admin picks the
  // OASIS partner from the list — other shelters won't typically execute a
  // DV-survivor DSA (they'd use a different agreement kind).
  const shelters = await db
    .select({ id: partnerOrgs.id, name: partnerOrgs.name })
    .from(partnerOrgs)
    .where(eq(partnerOrgs.type, 'shelter'))
    .orderBy(partnerOrgs.name);

  if (shelters.length === 0) {
    return (
      <div className="mx-auto max-w-2xl space-y-4 p-4 md:p-6">
        <header>
          <h1 className="font-serif text-3xl font-bold text-primary">
            OASIS data-sharing agreements
          </h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Record OASIS DSAs for the DV survivor pathway.
          </p>
        </header>
        <div className="rounded-md border border-border bg-muted/20 p-6 text-sm">
          <p className="font-semibold">No shelter-type partner orgs found.</p>
          <p className="mt-2 text-muted-foreground">
            Add a partner org with <code className="font-mono">type = &apos;shelter&apos;</code>{' '}
            (e.g. &quot;OASIS Shelter (DV / SUD)&quot;) before recording a DSA. Contact the
            coalition data steward to add partners.
          </p>
        </div>
      </div>
    );
  }

  const activeAgreements: Record<
    string,
    { id: string; effectiveDate: string | null; status: string } | undefined
  > = {};

  await Promise.all(
    shelters.map(async (s) => {
      const active = await getActiveOasisDsa(s.id);
      if (active) {
        activeAgreements[s.id] = {
          id: active.id,
          effectiveDate: active.effectiveDate,
          status: active.status,
        };
      }
    }),
  );

  // List all DSA agreements (any status, any agency) for these shelters; we
  // surface them in the recorded-agreements table to give admins an audit
  // trail. Most rows here will be OASIS, but a non-OASIS DSA on a shelter
  // (e.g. future amendments) would also appear with its kind/agency clearly
  // tagged.
  const allAgreements = (
    await Promise.all(shelters.map((s) => listAgreementsForPartner(s.id, { status: 'any' })))
  ).flat();

  const shelterIndex = Object.fromEntries(shelters.map((s) => [s.id, s.name]));

  return (
    <div className="mx-auto max-w-3xl space-y-8 p-4 md:p-6">
      <header>
        <h1 className="font-serif text-3xl font-bold text-primary">
          OASIS data-sharing agreements
        </h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Record and track DSAs with OASIS (Owensboro Area Shelter and Information Services) for the
          DV survivor pathway. Survivors are not in state custody — abuser-blind discipline at the
          contract layer is the cornerstone. OASIS should review the{' '}
          <Link
            href="/agreements/oasis/template"
            target="_blank"
            rel="noopener noreferrer"
            className="underline underline-offset-2 hover:text-foreground"
          >
            agreement template
          </Link>{' '}
          before signing. See <strong>ADR 0007</strong> for the privacy contract this agreement
          enforces.
        </p>
      </header>

      {allAgreements.length > 0 && (
        <section className="space-y-3">
          <h2 className="text-base font-semibold">Recorded agreements</h2>
          <div className="overflow-x-auto rounded-md border border-border">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b bg-muted/30 text-left">
                  <th className="px-3 py-2 font-medium">Partner</th>
                  <th className="px-3 py-2 font-medium">Kind</th>
                  <th className="px-3 py-2 font-medium">Status</th>
                  <th className="px-3 py-2 font-medium">Effective</th>
                  <th className="px-3 py-2 font-medium">Ends</th>
                </tr>
              </thead>
              <tbody>
                {allAgreements.map((a) => (
                  <tr key={a.id} className="border-b last:border-0">
                    <td className="px-3 py-2">{shelterIndex[a.partnerOrgId] ?? a.partnerOrgId}</td>
                    <td className="px-3 py-2 font-mono text-xs uppercase">{a.kind}</td>
                    <td className="px-3 py-2">
                      <span
                        className={
                          a.status === 'active'
                            ? 'rounded bg-emerald-100 px-1.5 py-0.5 text-[10px] font-medium text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-400'
                            : 'rounded bg-muted px-1.5 py-0.5 text-[10px] font-medium text-muted-foreground'
                        }
                      >
                        {a.status}
                      </span>
                    </td>
                    <td className="px-3 py-2 tabular-nums">{a.effectiveDate ?? '—'}</td>
                    <td className="px-3 py-2 tabular-nums">{a.endDate ?? 'open'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      )}

      <section className="space-y-4">
        <h2 className="text-base font-semibold">Record a new OASIS DSA</h2>
        <OasisDsaAgreementForm shelters={shelters} activeAgreements={activeAgreements} />
      </section>
    </div>
  );
}
