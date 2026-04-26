import { notFound } from 'next/navigation';
import { ConsentForm } from '@/components/consent/consent-form';
import { Card, CardContent } from '@/components/ui/card';
import { type ConsentType, consentTypeEnum } from '@/db/schema/enums';
import { consentTextFor } from '@/lib/dtrs/consent-text';
import { isValidSyntheticPersonRef } from '@/lib/synthetic-person';

export const metadata = {
  title: 'Sharing agreement',
};

const VALID_TYPES = new Set<ConsentType>(consentTypeEnum.enumValues);

export default async function GrantConsentPage({
  params,
  searchParams,
}: {
  params: Promise<{ ref: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const { ref } = await params;
  const sp = await searchParams;
  if (!isValidSyntheticPersonRef(ref)) notFound();

  const rawType = Array.isArray(sp.type) ? sp.type[0] : sp.type;
  const consentType: ConsentType =
    rawType && VALID_TYPES.has(rawType as ConsentType)
      ? (rawType as ConsentType)
      : 'phi_share_within_coalition';
  const copy = consentTextFor(consentType);

  return (
    <div className="mx-auto max-w-xl space-y-4 p-6">
      <header>
        <p className="text-xs text-muted-foreground">
          Identifier <span className="font-mono">{ref}</span>
        </p>
      </header>

      <Card>
        <CardContent className="pt-6">
          <ConsentForm subjectExternalId={ref} consentType={consentType} copy={copy} />
        </CardContent>
      </Card>

      <Card className="border-amber-500/40 bg-amber-500/5">
        <CardContent className="text-xs">
          <p className="font-medium">Phase-1 stub.</p>
          <p className="mt-1 text-muted-foreground">
            This page is open to anyone with the URL today. A one-time-link auth gate (#251) is the
            follow-up that scopes write access to the right person. The wording itself is reviewed
            in DTRS-005 advisor sessions before any client traffic flows.
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
