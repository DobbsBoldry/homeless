import Link from 'next/link';
import { notFound } from 'next/navigation';
import { VoucherApplyButton } from '@/components/subp/voucher-apply-button';
import { listApplicationsForVeteran, listVouchers } from '@/db/queries/hud-vash-vouchers';
import { getVeteran } from '@/db/queries/veterans';
import { requireRole } from '@/lib/auth';
import { describeVeteranEligibility, isVeteranEligible, scoreVoucherMatch } from '@/lib/subp';

export const dynamic = 'force-dynamic';

interface Props {
  params: Promise<{ id: string }>;
}

export default async function VeteranDetailPage({ params }: Props) {
  await requireRole(['caseworker', 'admin']);
  const { id } = await params;

  const veteran = await getVeteran(id);
  if (!veteran) notFound();

  const eligible = isVeteranEligible(veteran);

  // Voucher panel only when the veteran flag is set (SUBP-006b AC).
  const [vouchers, applications] = eligible
    ? await Promise.all([listVouchers({ availableOnly: true }), listApplicationsForVeteran(id)])
    : [[], []];

  const appliedVoucherIds = new Set(
    applications.filter((a) => a.status === 'applied').map((a) => a.voucherId),
  );

  const scored = vouchers
    .map((v) => ({
      voucher: v,
      match: scoreVoucherMatch(
        {
          bedroomNeed: veteran.bedroomNeed,
          accessibilityNeed: veteran.accessibilityNeed,
          targetZip: veteran.targetZip,
        },
        { bedrooms: v.bedrooms, accessible: v.accessible, zip: v.zip },
      ),
      applied: appliedVoucherIds.has(v.id),
    }))
    .sort((a, b) => b.match.score - a.match.score);

  return (
    <div className="mx-auto max-w-3xl space-y-6 p-4 md:p-6">
      <div className="text-xs">
        <Link href="/app/clients/veterans" className="text-muted-foreground hover:underline">
          ← Back to veterans
        </Link>
      </div>

      <header>
        <h1 className="font-serif text-3xl font-bold text-primary">
          {veteran.legalFirstName} {veteran.legalLastName}
        </h1>
        <p className="mt-1 text-sm text-muted-foreground">
          {veteran.branchOfService ?? 'Branch unknown'} ·{' '}
          <span className={eligible ? 'text-emerald-700 dark:text-emerald-400' : ''}>
            {describeVeteranEligibility(veteran)}
          </span>{' '}
          · <span className="font-mono text-xs">{veteran.syntheticPersonRef}</span>
        </p>
      </header>

      <section className="rounded-md border border-border p-4 text-sm">
        <h2 className="text-sm font-semibold">Housing profile</h2>
        <dl className="mt-2 grid grid-cols-2 gap-x-3 gap-y-1 text-xs text-muted-foreground sm:grid-cols-3">
          <div>
            <dt className="inline font-medium">Bedrooms needed: </dt>
            <dd className="inline tabular-nums">{veteran.bedroomNeed ?? '—'}</dd>
          </div>
          <div>
            <dt className="inline font-medium">Accessible unit: </dt>
            <dd className="inline">{veteran.accessibilityNeed ? 'required' : 'no'}</dd>
          </div>
          <div>
            <dt className="inline font-medium">Target ZIP: </dt>
            <dd className="inline">{veteran.targetZip ?? '—'}</dd>
          </div>
        </dl>
      </section>

      <section className="space-y-3">
        <h2 className="text-sm font-semibold">HUD-VASH voucher matches</h2>
        {!eligible ? (
          <div className="rounded-md border border-amber-500/40 bg-amber-500/5 p-4 text-sm">
            <p className="font-medium text-amber-700 dark:text-amber-400">
              Voucher matching is hidden until veteran status is confirmed.
            </p>
            <p className="mt-1 text-xs text-muted-foreground">
              Confirm eligibility from the veterans list to surface matched vouchers.
            </p>
          </div>
        ) : scored.length === 0 ? (
          <div className="rounded-md border border-border bg-muted/20 p-4 text-sm text-muted-foreground">
            No available vouchers in the seed data. An admin can add vouchers under{' '}
            <Link href="/app/admin/vouchers" className="underline">
              admin → vouchers
            </Link>
            .
          </div>
        ) : (
          <ul className="space-y-2">
            {scored.map(({ voucher: v, match, applied }) => (
              <li key={v.id} className="rounded-md border border-border bg-card p-3 text-sm">
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <p className="font-medium">
                      {v.unitType}{' '}
                      <span className="font-mono text-[10px] text-muted-foreground">
                        {v.voucherCode}
                      </span>
                    </p>
                    <p className="text-xs text-muted-foreground">
                      {v.location}
                      {v.zip ? ` · ${v.zip}` : ''} · {v.bedrooms}br
                      {v.accessible ? ' · accessible' : ''} · {v.availabilityStatus}
                    </p>
                  </div>
                  <span
                    className={`shrink-0 rounded px-2 py-0.5 text-xs font-semibold tabular-nums ${
                      match.score >= 70
                        ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-400'
                        : match.score >= 40
                          ? 'bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-400'
                          : 'bg-zinc-100 text-zinc-600 dark:bg-zinc-800 dark:text-zinc-300'
                    }`}
                  >
                    {match.score}% match
                  </span>
                </div>
                <p className="mt-1 text-[10px] text-muted-foreground">
                  {match.factors.map((f) => `${f.label}: ${f.detail}`).join(' · ')}
                </p>
                <div className="mt-2">
                  {applied ? (
                    <span className="rounded bg-emerald-600/15 px-2 py-0.5 text-xs text-emerald-700 dark:text-emerald-400">
                      Applied
                    </span>
                  ) : (
                    <VoucherApplyButton veteranId={veteran.id} voucherId={v.id} />
                  )}
                </div>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
