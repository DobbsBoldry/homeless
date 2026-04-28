import Link from 'next/link';
import { notFound } from 'next/navigation';
import { MedicaidExtensionPanel } from '@/components/subp/medicaid-extension-panel';
import { getFosterYouth } from '@/db/queries/foster-youth';
import { listApplicationsForYouth } from '@/db/queries/medicaid-extension';
import { requireRole } from '@/lib/auth';
import { isEligibleForExtension } from '@/lib/subp';

export const dynamic = 'force-dynamic';

interface Props {
  params: Promise<{ id: string }>;
}

export default async function MedicaidExtensionPage({ params }: Props) {
  await requireRole(['caseworker', 'admin']);
  const { id } = await params;

  const youth = await getFosterYouth(id);
  if (!youth) notFound();

  const applications = await listApplicationsForYouth(youth.id);

  // Eligibility check uses the most recent application's
  // `in_foster_care_at_18` answer if available, else assumes true (the
  // youth is in DCBS custody). Caseworker confirms in the form.
  const inFosterAt18 = applications[0]?.applicationPayload.in_foster_care_at_18 ?? true;
  const eligibility = isEligibleForExtension(
    {
      dateOfBirth: youth.dateOfBirth,
      status: youth.status,
      inFosterCareAt18: inFosterAt18,
    },
    new Date(),
  );

  return (
    <div className="mx-auto max-w-3xl space-y-6 p-4 md:p-6">
      <div className="text-xs">
        <Link
          href={`/app/clients/foster-aging-out/${youth.id}`}
          className="text-muted-foreground hover:underline"
        >
          ← Back to {youth.legalFirstName} {youth.legalLastName}
        </Link>
      </div>

      <header>
        <h1 className="font-serif text-3xl font-bold text-primary">TEAMKY Medicaid extension</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Former Foster Youth Medicaid extension under{' '}
          <code className="font-mono text-xs">42 U.S.C. § 1396a(a)(10)(A)(i)(IX)</code>. Eligibility
          window: 18 → 26.
        </p>
      </header>

      {!eligibility.eligible && (
        <div className="rounded-md border border-amber-500/40 bg-amber-500/5 p-3 text-sm">
          <p className="font-medium">Eligibility check failed</p>
          <ul className="mt-2 list-disc pl-5 text-xs text-muted-foreground">
            {eligibility.reasons.map((r) => (
              <li key={r}>{describeReason(r)}</li>
            ))}
          </ul>
          <p className="mt-2 text-xs text-muted-foreground">
            You can still draft an application below; submit will be blocked at the kynect layer if
            eligibility is confirmed-denied.
          </p>
        </div>
      )}

      <MedicaidExtensionPanel
        youthId={youth.id}
        youthName={`${youth.legalFirstName} ${youth.legalLastName}`}
        dcbsCaseId={youth.dcbsCaseId}
        applications={applications.map((a) => ({
          id: a.id,
          status: a.status,
          payload: a.applicationPayload,
          kynectReference: a.kynectReference,
          draftedAt: a.draftedAt.toISOString(),
          submittedAt: a.submittedAt?.toISOString() ?? null,
          decisionAt: a.decisionAt?.toISOString() ?? null,
          decisionReason: a.decisionReason,
          withdrawnAt: a.withdrawnAt?.toISOString() ?? null,
        }))}
      />
    </div>
  );
}

function describeReason(reason: string): string {
  switch (reason) {
    case 'under_18':
      return 'Youth is under 18 — extension applies only to former foster youth.';
    case 'over_25':
      return 'Youth is past their 26th birthday — extension caps at 26.';
    case 'not_in_foster_care_at_18':
      return 'Youth was not in foster care at 18 (per the most recent application).';
    default:
      return reason;
  }
}
