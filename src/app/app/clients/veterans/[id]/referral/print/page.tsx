import Link from 'next/link';
import { notFound } from 'next/navigation';
import { PrintButton } from '@/components/coordination/print-button';
import { getVeteran } from '@/db/queries/veterans';
import { getLatestVfwReferral } from '@/db/queries/vfw-referrals';
import { requireRole } from '@/lib/auth';
import { VETERAN_VOUCHER_STAGE_LABELS, type VfwReferralPacket } from '@/lib/subp';

export const dynamic = 'force-dynamic';

interface Props {
  params: Promise<{ id: string }>;
}

/**
 * SUBP-006c — printable VFW referral packet. Renders the latest referral's
 * JSONB snapshot in a print-optimized layout; VFW staff print it to PDF
 * (the app chrome is `print:hidden` at the layout level).
 */
export default async function VfwReferralPrintPage({ params }: Props) {
  await requireRole(['caseworker', 'admin']);
  const { id } = await params;

  const veteran = await getVeteran(id);
  if (!veteran) notFound();

  const referral = await getLatestVfwReferral(id);
  if (!referral) {
    return (
      <div className="mx-auto max-w-2xl space-y-3 p-6">
        <h1 className="font-serif text-2xl font-bold text-primary">No referral yet</h1>
        <p className="text-sm text-muted-foreground">
          Generate a VFW referral from the{' '}
          <Link href={`/app/clients/veterans/${id}`} className="underline">
            veteran detail view
          </Link>{' '}
          first.
        </p>
      </div>
    );
  }

  const packet = referral.packet as VfwReferralPacket;
  const dateStr = new Intl.DateTimeFormat('en-US', { dateStyle: 'long' }).format(
    new Date(referral.createdAt),
  );

  return (
    <div className="mx-auto max-w-3xl p-8 print:p-0">
      <div className="mb-4 flex items-center justify-between print:hidden">
        <Link
          href={`/app/clients/veterans/${id}`}
          className="text-xs text-muted-foreground hover:underline"
        >
          ← Back to veteran
        </Link>
        <PrintButton />
      </div>

      <div className="space-y-6 rounded-lg border border-border bg-white p-8 text-black shadow-sm print:border-0 print:shadow-none">
        <header className="border-b pb-4">
          <p className="text-xs font-medium uppercase tracking-widest text-zinc-500">
            Daviess County Homeless Coalition · HUD-VASH Veteran Pathway
          </p>
          <h1 className="mt-1 font-serif text-2xl font-bold">VFW Housing Referral</h1>
          <p className="mt-1 text-sm text-zinc-600">
            To: {packet.recipient} · {dateStr}
          </p>
        </header>

        <section>
          <h2 className="text-sm font-semibold">Subject</h2>
          <dl className="mt-1 grid grid-cols-2 gap-x-4 gap-y-1 text-sm">
            <div>
              <dt className="inline font-medium">Name: </dt>
              <dd className="inline">{packet.subject.fullName}</dd>
            </div>
            <div>
              <dt className="inline font-medium">Reference: </dt>
              <dd className="inline font-mono text-xs">{packet.subject.personRef}</dd>
            </div>
            <div>
              <dt className="inline font-medium">Branch: </dt>
              <dd className="inline">{packet.subject.branchOfService}</dd>
            </div>
            <div className="col-span-2">
              <dt className="inline font-medium">Housing profile: </dt>
              <dd className="inline">{packet.subject.housingProfile}</dd>
            </div>
          </dl>
        </section>

        <section>
          <h2 className="text-sm font-semibold">Eligibility</h2>
          <p className="mt-1 text-sm">{packet.eligibilitySummary}</p>
        </section>

        <section>
          <h2 className="text-sm font-semibold">Coalition contact</h2>
          <p className="mt-1 text-sm">{packet.contact.caseworkerName}</p>
        </section>

        <section>
          <h2 className="text-sm font-semibold">
            Matched HUD-VASH vouchers ({packet.matchedVouchers.length})
          </h2>
          {packet.matchedVouchers.length === 0 ? (
            <p className="mt-1 text-sm text-zinc-600">No available vouchers at referral time.</p>
          ) : (
            <table className="mt-2 w-full border-collapse text-sm">
              <thead>
                <tr className="border-b text-left">
                  <th className="py-1 pr-2 font-medium">Voucher</th>
                  <th className="py-1 pr-2 font-medium">Unit</th>
                  <th className="py-1 pr-2 font-medium">Location</th>
                  <th className="py-1 pr-2 font-medium">Match</th>
                  <th className="py-1 font-medium">Stage</th>
                </tr>
              </thead>
              <tbody>
                {packet.matchedVouchers.map((m) => (
                  <tr key={m.voucherCode} className="border-b last:border-0">
                    <td className="py-1 pr-2 font-mono text-xs">{m.voucherCode}</td>
                    <td className="py-1 pr-2">
                      {m.unitType} ({m.bedrooms}br)
                    </td>
                    <td className="py-1 pr-2">
                      {m.location}
                      {m.zip ? ` · ${m.zip}` : ''}
                    </td>
                    <td className="py-1 pr-2 tabular-nums">{m.score}%</td>
                    <td className="py-1">{VETERAN_VOUCHER_STAGE_LABELS[m.stage]}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </section>

        <footer className="border-t pt-3 text-xs text-zinc-500">
          Synthetic / pilot data — not a legal instrument. Generated by the Daviess Coalition
          platform for VFW review.
        </footer>
      </div>
    </div>
  );
}
