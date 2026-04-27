import Link from 'next/link';
import type { IntakeProfile } from '@/ai/prompts/intake-extraction';
import { BenefitsScreener } from '@/components/cwt/benefits-screener';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { getClientIntakeById } from '@/db/queries/client-intakes';
import { requireRole } from '@/lib/auth';
import { intakeProfileToScreenerPrefill } from '@/lib/cwt/intake-to-screener';

export const dynamic = 'force-dynamic';

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export default async function BenefitsScreenerPage({
  searchParams,
}: {
  searchParams: Promise<{ fromIntake?: string }>;
}) {
  await requireRole(['caseworker', 'shelter_staff', 'admin']);
  const sp = await searchParams;

  let prefill: Awaited<ReturnType<typeof loadPrefill>> = null;
  if (sp.fromIntake && UUID_RE.test(sp.fromIntake)) {
    prefill = await loadPrefill(sp.fromIntake);
  }

  return (
    <div className="mx-auto max-w-5xl space-y-4 p-4 md:p-6">
      <header>
        <h1 className="font-serif text-3xl font-bold text-primary">Benefits screener</h1>
        <p className="text-sm text-muted-foreground">
          Quick eligibility screen across SNAP, KCHIP, Medicaid, KTAP, SSI, VA, and LIHEAP. Type the
          household details on the left; results update live on the right. Nothing is saved.
        </p>
      </header>

      {prefill ? (
        <Card className="border-primary/40 bg-primary/5">
          <CardContent className="text-sm">
            <p className="font-medium">Prefilled from intake.</p>
            <p className="mt-1 text-muted-foreground">
              Pulled from{' '}
              <Link
                href={`/app/clients/intakes/${prefill.intakeId}`}
                className="text-primary hover:underline"
              >
                "{prefill.intakeLabel}"
              </Link>
              . Adjust any field below before quoting numbers — the AI gets things wrong.
            </p>
          </CardContent>
        </Card>
      ) : null}

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Household details</CardTitle>
        </CardHeader>
        <CardContent>
          <BenefitsScreener
            initialHousehold={prefill?.initialHousehold}
            prefillSource={
              prefill && prefill.prefillFields.length > 0
                ? { fields: prefill.prefillFields, label: 'from intake' }
                : undefined
            }
            contextNote={prefill?.contextNote ?? null}
          />
        </CardContent>
      </Card>
    </div>
  );
}

async function loadPrefill(intakeId: string) {
  const intake = await getClientIntakeById(intakeId);
  if (!intake?.extractedProfile) return null;
  const profile = intake.extractedProfile as IntakeProfile;
  const { initialHousehold, prefillFields, contextNote } = intakeProfileToScreenerPrefill(profile);
  return {
    intakeId: intake.id,
    intakeLabel: intake.label,
    initialHousehold,
    prefillFields,
    contextNote,
  };
}
