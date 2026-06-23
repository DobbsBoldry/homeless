import { VoucherAdmin } from '@/components/subp/voucher-admin';
import { listVouchers } from '@/db/queries/hud-vash-vouchers';
import { requireRole } from '@/lib/auth';

export const dynamic = 'force-dynamic';

export default async function AdminVouchersPage() {
  await requireRole(['admin']);
  const vouchers = await listVouchers();

  return (
    <div className="mx-auto max-w-4xl space-y-4 p-6">
      <header>
        <h1 className="font-serif text-3xl font-bold text-primary">HUD-VASH vouchers</h1>
        <p className="text-sm text-muted-foreground">
          Admin-managed seed data for the veteran pathway (SUBP-006b). These vouchers are matched
          against veteran subject profiles on the veteran detail view. The live VA feed replaces
          this once the DTRS-015 data-sharing agreement is in place. Synthetic data only.
        </p>
      </header>
      <VoucherAdmin vouchers={vouchers} />
    </div>
  );
}
