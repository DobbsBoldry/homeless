import { ne } from 'drizzle-orm';
import Link from 'next/link';
import { MouAgreementForm } from '@/components/dtrs/mou-agreement-form';
import { db } from '@/db/client';
import {
  getActiveAgreementByKind,
  listAgreementsForPartner,
} from '@/db/queries/partner-agreements';
import { partnerOrgs } from '@/db/schema/partner-orgs';
import { requireRole } from '@/lib/auth';

export const dynamic = 'force-dynamic';

export default async function MouAgreementsPage() {
  await requireRole(['admin']);

  // Eligible partners: any non-school partner_org. Schools have their own
  // FERPA agreements (DTRS-010); MOUs are for everyone else.
  const partners = await db
    .select({ id: partnerOrgs.id, name: partnerOrgs.name, type: partnerOrgs.type })
    .from(partnerOrgs)
    .where(ne(partnerOrgs.type, 'school'))
    .orderBy(partnerOrgs.name);

  if (partners.length === 0) {
    return (
      <div className="mx-auto max-w-2xl space-y-4 p-4 md:p-6">
        <header>
          <h1 className="font-serif text-3xl font-bold text-primary">MOU registry</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Record memoranda of understanding with coalition partners.
          </p>
        </header>
        <div className="rounded-md border border-border bg-muted/20 p-6 text-sm">
          <p className="font-semibold">No partner orgs found.</p>
          <p className="mt-2 text-muted-foreground">
            Add a partner org of any non-school type before recording an MOU.
          </p>
        </div>
      </div>
    );
  }

  const activeAgreements: Record<
    string,
    { id: string; effectiveDate: string | null; endDate: string | null; status: string } | undefined
  > = {};

  await Promise.all(
    partners.map(async (p) => {
      const active = await getActiveAgreementByKind(p.id, 'mou');
      if (active) {
        activeAgreements[p.id] = {
          id: active.id,
          effectiveDate: active.effectiveDate,
          endDate: active.endDate,
          status: active.status,
        };
      }
    }),
  );

  const allMous = (
    await Promise.all(partners.map((p) => listAgreementsForPartner(p.id, { status: 'any' })))
  )
    .flat()
    .filter((a) => a.kind === 'mou');

  const partnerIndex = Object.fromEntries(partners.map((p) => [p.id, p]));

  return (
    <div className="mx-auto max-w-3xl space-y-8 p-4 md:p-6">
      <header>
        <h1 className="font-serif text-3xl font-bold text-primary">MOU registry</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Record and track MOUs with coalition partners. Stored in the polymorphic
          partner-agreements registry per <strong>ADR 0004</strong>; expirations watched by the
          daily <code className="font-mono text-xs">agreement-expiration-watcher</code> Inngest job.
        </p>
      </header>

      {allMous.length > 0 && (
        <section className="space-y-3">
          <h2 className="text-base font-semibold">Recorded MOUs</h2>
          <div className="overflow-x-auto rounded-md border border-border">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b bg-muted/30 text-left">
                  <th className="px-3 py-2 font-medium">Partner</th>
                  <th className="px-3 py-2 font-medium">Type</th>
                  <th className="px-3 py-2 font-medium">Status</th>
                  <th className="px-3 py-2 font-medium">Effective</th>
                  <th className="px-3 py-2 font-medium">Ends</th>
                </tr>
              </thead>
              <tbody>
                {allMous.map((a) => {
                  const partner = partnerIndex[a.partnerOrgId];
                  return (
                    <tr key={a.id} className="border-b last:border-0">
                      <td className="px-3 py-2">{partner?.name ?? a.partnerOrgId}</td>
                      <td className="px-3 py-2 text-xs capitalize text-muted-foreground">
                        {partner?.type?.replace(/_/g, ' ')}
                      </td>
                      <td className="px-3 py-2">
                        <span
                          className={
                            a.status === 'active'
                              ? 'rounded bg-emerald-100 px-1.5 py-0.5 text-[10px] font-medium text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-400'
                              : a.status === 'expired'
                                ? 'rounded bg-amber-100 px-1.5 py-0.5 text-[10px] font-medium text-amber-700 dark:bg-amber-900/40 dark:text-amber-400'
                                : 'rounded bg-muted px-1.5 py-0.5 text-[10px] font-medium text-muted-foreground'
                          }
                        >
                          {a.status}
                        </span>
                      </td>
                      <td className="px-3 py-2 tabular-nums">{a.effectiveDate ?? '—'}</td>
                      <td className="px-3 py-2 tabular-nums">{a.endDate ?? 'open'}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </section>
      )}

      <section className="space-y-4">
        <h2 className="text-base font-semibold">Record a new MOU</h2>
        <MouAgreementForm partners={partners} activeAgreements={activeAgreements} />
      </section>

      <p className="text-xs text-muted-foreground">
        Looking for{' '}
        <Link
          href="/app/admin/agreements/ferpa"
          className="underline underline-offset-2 hover:text-foreground"
        >
          FERPA
        </Link>{' '}
        or{' '}
        <Link
          href="/app/admin/agreements/dcbs"
          className="underline underline-offset-2 hover:text-foreground"
        >
          DCBS
        </Link>{' '}
        agreements?
      </p>
    </div>
  );
}
