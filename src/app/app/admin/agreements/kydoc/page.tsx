import { eq } from 'drizzle-orm';
import Link from 'next/link';
import { KyDocDsaAgreementForm } from '@/components/dtrs/kydoc-dsa-agreement-form';
import { db } from '@/db/client';
import { getActiveKyDocDsa, listAgreementsForPartner } from '@/db/queries/partner-agreements';
import { partnerOrgs } from '@/db/schema/partner-orgs';
import { requireRole } from '@/lib/auth';

export const dynamic = 'force-dynamic';

export default async function KyDocAgreementsPage() {
  await requireRole(['admin']);

  // KY DOC is type='government' in the seeded directory. The admin picks the
  // KY DOC partner from the list — other government partners (e.g. DCBS, OASIS
  // sister-agencies that also seeded as government) won't typically execute a
  // reentry DSA, but they'd appear here for selection clarity.
  const partners = await db
    .select({ id: partnerOrgs.id, name: partnerOrgs.name })
    .from(partnerOrgs)
    .where(eq(partnerOrgs.type, 'government'))
    .orderBy(partnerOrgs.name);

  if (partners.length === 0) {
    return (
      <div className="mx-auto max-w-2xl space-y-4 p-4 md:p-6">
        <header>
          <h1 className="font-serif text-3xl font-bold text-primary">
            KY DOC data-sharing agreements
          </h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Record KY DOC DSAs for the reentry pathway.
          </p>
        </header>
        <div className="rounded-md border border-border bg-muted/20 p-6 text-sm">
          <p className="font-semibold">No government-type partner orgs found.</p>
          <p className="mt-2 text-muted-foreground">
            Add a partner org with <code className="font-mono">type = &apos;government&apos;</code>{' '}
            (e.g. &quot;Kentucky Department of Corrections&quot;) before recording a DSA. Contact
            the coalition data steward to add partners.
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
    partners.map(async (p) => {
      const active = await getActiveKyDocDsa(p.id);
      if (active) {
        activeAgreements[p.id] = {
          id: active.id,
          effectiveDate: active.effectiveDate,
          status: active.status,
        };
      }
    }),
  );

  // List all DSA agreements (any status, any agency) for these government
  // partners. Most rows here will be KY DOC, but a non-KY-DOC DSA on a
  // government partner (e.g. DCBS amendments, future agency expansions) would
  // also appear with its kind/agency clearly tagged.
  const allAgreements = (
    await Promise.all(partners.map((p) => listAgreementsForPartner(p.id, { status: 'any' })))
  ).flat();

  const partnerIndex = Object.fromEntries(partners.map((p) => [p.id, p.name]));

  return (
    <div className="mx-auto max-w-3xl space-y-8 p-4 md:p-6">
      <header>
        <h1 className="font-serif text-3xl font-bold text-primary">
          KY DOC data-sharing agreements
        </h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Record and track DSAs with the Kentucky Department of Corrections for the reentry pathway.
          The agreement establishes a bounded pre-release window during which KY DOC may share
          records of Daviess County residents approaching release. KY DOC should review the{' '}
          <Link
            href="/agreements/kydoc/template"
            target="_blank"
            rel="noopener noreferrer"
            className="underline underline-offset-2 hover:text-foreground"
          >
            agreement template
          </Link>{' '}
          before signing. See <strong>ADR 0009</strong> for the privacy contract this agreement
          enforces — including the no-recidivism-prediction commitment and the no-LE-disclosure
          rule.
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
                    <td className="px-3 py-2">{partnerIndex[a.partnerOrgId] ?? a.partnerOrgId}</td>
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
        <h2 className="text-base font-semibold">Record a new KY DOC DSA</h2>
        <KyDocDsaAgreementForm partners={partners} activeAgreements={activeAgreements} />
      </section>
    </div>
  );
}
