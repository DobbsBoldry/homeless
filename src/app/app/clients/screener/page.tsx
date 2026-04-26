import { BenefitsScreener } from '@/components/cwt/benefits-screener';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { requireRole } from '@/lib/auth';

export const dynamic = 'force-dynamic';

export default async function BenefitsScreenerPage() {
  await requireRole(['caseworker', 'shelter_staff', 'admin']);

  return (
    <div className="mx-auto max-w-5xl space-y-4 p-4 md:p-6">
      <header>
        <h1 className="font-serif text-3xl font-bold text-primary">Benefits screener</h1>
        <p className="text-sm text-muted-foreground">
          Quick eligibility screen across SNAP, KCHIP, Medicaid, KTAP, SSI, VA, and LIHEAP. Type the
          household details on the left; results update live on the right. Nothing is saved.
        </p>
      </header>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Household details</CardTitle>
        </CardHeader>
        <CardContent>
          <BenefitsScreener />
        </CardContent>
      </Card>
    </div>
  );
}
