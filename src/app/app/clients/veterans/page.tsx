import Link from 'next/link';
import { VeteranVerifyControl } from '@/components/subp/veteran-verify-control';
import { listAllVoucherApplications } from '@/db/queries/hud-vash-vouchers';
import { listVeterans } from '@/db/queries/veterans';
import { requireRole } from '@/lib/auth';
import {
  deriveVeteranVoucherStage,
  describeVeteranEligibility,
  isVeteranEligible,
  VETERAN_VOUCHER_STAGE_LABELS,
  type VeteranVoucherStage,
} from '@/lib/subp';

export const dynamic = 'force-dynamic';

const STAGE_BADGE: Record<VeteranVoucherStage, string> = {
  not_applied: 'bg-zinc-100 text-zinc-600 dark:bg-zinc-800 dark:text-zinc-300',
  applied: 'bg-sky-100 text-sky-700 dark:bg-sky-900/40 dark:text-sky-400',
  pending: 'bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-400',
  approved: 'bg-indigo-100 text-indigo-700 dark:bg-indigo-900/40 dark:text-indigo-400',
  housed: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-400',
};

export default async function VeteransListPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  await requireRole(['caseworker', 'admin']);

  const sp = await searchParams;
  const eligibleOnly = (Array.isArray(sp.filter) ? sp.filter[0] : sp.filter) === 'eligible';

  const [subjects, allApplications] = await Promise.all([
    listVeterans({ status: 'any', eligibleOnly }),
    listAllVoucherApplications(),
  ]);

  // SUBP-006c: roll each subject's applications up to a single pipeline stage.
  const appsByVeteran = new Map<string, { status: string }[]>();
  for (const a of allApplications) {
    const list = appsByVeteran.get(a.veteranId) ?? [];
    list.push(a);
    appsByVeteran.set(a.veteranId, list);
  }
  const stageFor = (veteranId: string): VeteranVoucherStage =>
    deriveVeteranVoucherStage(appsByVeteran.get(veteranId) ?? []);

  return (
    <div className="mx-auto max-w-5xl space-y-6 p-4 md:p-6">
      <div className="text-xs">
        <Link href="/app/clients" className="text-muted-foreground hover:underline">
          ← Back to clients
        </Link>
      </div>
      <header>
        <h1 className="font-serif text-3xl font-bold text-primary">Veterans</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Veteran pathway (SUBP-006a). A subject is veteran-eligible when VA documentation is
          confirmed, or when a self-reported claim has been verified by a caseworker. Voucher
          matching and VFW referrals land in later slices. Synthetic data only until BAA closes.
        </p>
      </header>

      <nav className="flex gap-2 text-xs">
        <Link
          href="/app/clients/veterans"
          className={`rounded-md border px-3 py-1.5 ${
            eligibleOnly ? 'border-input hover:bg-muted' : 'border-primary/40 bg-primary/10'
          }`}
        >
          All
        </Link>
        <Link
          href="/app/clients/veterans?filter=eligible"
          className={`rounded-md border px-3 py-1.5 ${
            eligibleOnly ? 'border-primary/40 bg-primary/10' : 'border-input hover:bg-muted'
          }`}
        >
          Veteran-eligible only
        </Link>
      </nav>

      {subjects.length === 0 ? (
        <div className="rounded-md border border-border bg-muted/20 p-6 text-sm">
          <p className="font-semibold">
            No veteran records{eligibleOnly ? ' match this filter' : ''}.
          </p>
          <p className="mt-2 text-muted-foreground">
            Run <code className="font-mono">pnpm db:seed</code> for synthetic data, or add records
            as veterans are identified.
          </p>
        </div>
      ) : (
        <div className="overflow-x-auto rounded-md border border-border">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b bg-muted/30 text-left">
                <th className="px-3 py-2 font-medium">Name</th>
                <th className="px-3 py-2 font-medium">Branch</th>
                <th className="px-3 py-2 font-medium">Eligibility</th>
                <th className="px-3 py-2 font-medium">Voucher stage</th>
                <th className="px-3 py-2 font-medium">Status</th>
                <th className="px-3 py-2 font-medium">Action</th>
              </tr>
            </thead>
            <tbody>
              {subjects.map((v) => {
                const eligible = isVeteranEligible(v);
                return (
                  <tr key={v.id} className="border-b last:border-0 hover:bg-muted/10">
                    <td className="px-3 py-2">
                      <Link
                        href={`/app/clients/veterans/${v.id}`}
                        className="font-medium hover:underline"
                      >
                        {v.legalFirstName} {v.legalLastName}
                      </Link>
                      <div className="font-mono text-[10px] text-muted-foreground">
                        {v.syntheticPersonRef}
                      </div>
                    </td>
                    <td className="px-3 py-2 text-xs text-muted-foreground">
                      {v.branchOfService ?? '—'}
                    </td>
                    <td className="px-3 py-2">
                      <span
                        className={`rounded px-1.5 py-0.5 text-[10px] font-medium ${
                          eligible
                            ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-400'
                            : 'bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-400'
                        }`}
                      >
                        {eligible ? 'eligible' : 'not yet eligible'}
                      </span>
                      <div className="mt-0.5 text-[10px] text-muted-foreground">
                        {describeVeteranEligibility(v)}
                      </div>
                    </td>
                    <td className="px-3 py-2">
                      {(() => {
                        const stage = stageFor(v.id);
                        return (
                          <span
                            className={`rounded px-1.5 py-0.5 text-[10px] font-medium ${STAGE_BADGE[stage]}`}
                          >
                            {VETERAN_VOUCHER_STAGE_LABELS[stage]}
                          </span>
                        );
                      })()}
                    </td>
                    <td className="px-3 py-2 capitalize text-muted-foreground">{v.status}</td>
                    <td className="px-3 py-2">
                      {v.eligibilitySource === 'self_reported' ? (
                        <VeteranVerifyControl veteranId={v.id} verified={v.caseworkerVerified} />
                      ) : (
                        <span className="text-[10px] text-muted-foreground">—</span>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
