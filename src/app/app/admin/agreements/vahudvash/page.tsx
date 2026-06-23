import { inArray } from 'drizzle-orm';
import Link from 'next/link';
import { VaHudVashDsaAgreementForm } from '@/components/dtrs/vahudvash-dsa-agreement-form';
import { db } from '@/db/client';
import { getActiveVaHudVashDsa, listAgreementsForPartner } from '@/db/queries/partner-agreements';
import { partnerOrgs } from '@/db/schema/partner-orgs';
import { requireRole } from '@/lib/auth';

export const dynamic = 'force-dynamic';

export default async function VaHudVashAgreementsPage() {
  await requireRole(['admin']);

  // VA HUD-VASH DSAs are joint instruments with the local PHA. The directory
  // surfaces both 'government' (VAMC) and 'community_org' (PHA) entries so
  // the admin can pick whichever org row was used to record the agreement.
  // Either side can be the partner_org_id of record per ADR 0010.
  const partners = await db
    .select({ id: partnerOrgs.id, name: partnerOrgs.name })
    .from(partnerOrgs)
    .where(inArray(partnerOrgs.type, ['government', 'community_org']))
    .orderBy(partnerOrgs.name);

  if (partners.length === 0) {
    return (
      <div className="mx-auto max-w-2xl space-y-4 p-4 md:p-6">
        <header>
          <h1 className="font-serif text-3xl font-bold text-primary">
            VA HUD-VASH data-sharing agreements
          </h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Record VA HUD-VASH DSAs for the veteran pathway.
          </p>
        </header>
        <div className="rounded-md border border-border bg-muted/20 p-6 text-sm">
          <p className="font-semibold">No eligible partner orgs found.</p>
          <p className="mt-2 text-muted-foreground">
            Add a partner org with <code className="font-mono">type = &apos;government&apos;</code>{' '}
            (e.g. &quot;Louisville VA Medical Center&quot;) and one with{' '}
            <code className="font-mono">type = &apos;community_org&apos;</code> (the local PHA)
            before recording a DSA. Contact the coalition data steward to add partners.
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
      const active = await getActiveVaHudVashDsa(p.id);
      if (active) {
        activeAgreements[p.id] = {
          id: active.id,
          effectiveDate: active.effectiveDate,
          status: active.status,
        };
      }
    }),
  );

  // Use a small partner index so we can match the 'where the agreement is
  // partner-of-record' display. Keep the table to all DSA agreements for these
  // partners; non-VA-HUDVASH DSAs are clearly tagged by kind.
  const allAgreements = (
    await Promise.all(partners.map((p) => listAgreementsForPartner(p.id, { status: 'any' })))
  ).flat();

  const partnerIndex = Object.fromEntries(partners.map((p) => [p.id, p.name]));

  return (
    <div className="mx-auto max-w-3xl space-y-8 p-4 md:p-6">
      <header>
        <h1 className="font-serif text-3xl font-bold text-primary">
          VA HUD-VASH data-sharing agreements
        </h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Record and track DSAs with the local VA Medical Center HUD-VASH program (joint with the
          local Public Housing Authority) for the veteran pathway. The agreement establishes a
          bounded voucher-search window during which the VA may share records of veterans with
          active HUD-VASH vouchers. Both signatories should review the{' '}
          <Link
            href="/agreements/vahudvash/template"
            target="_blank"
            rel="noopener noreferrer"
            className="underline underline-offset-2 hover:text-foreground"
          >
            agreement template
          </Link>{' '}
          before signing. See <strong>ADR 0010</strong> for the privacy contract this agreement
          enforces — including the no-service-denial-prediction commitment, the MH/SUD scope
          boundary, and the no-insurer-disclosure rule.
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
        <h2 className="text-base font-semibold">Record a new VA HUD-VASH DSA</h2>
        <VaHudVashDsaAgreementForm partners={partners} activeAgreements={activeAgreements} />
      </section>
    </div>
  );
}
