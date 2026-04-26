import { notFound } from 'next/navigation';
import { ConsentRow } from '@/components/consent/consent-row';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { listPersonPartnerSummary } from '@/db/queries/person-consents';
import { isValidSyntheticPersonRef } from '@/lib/synthetic-person';

export const metadata = {
  title: 'Your sharing settings',
};

export default async function ConsentPage({ params }: { params: Promise<{ ref: string }> }) {
  const { ref } = await params;
  if (!isValidSyntheticPersonRef(ref)) notFound();

  const rows = await listPersonPartnerSummary(ref);

  return (
    <div className="mx-auto max-w-3xl space-y-4 p-6">
      <header>
        <h1 className="font-serif text-3xl font-bold text-primary">Your sharing settings</h1>
        <p className="text-sm text-muted-foreground">
          Identifier: <span className="font-mono text-xs">{ref}</span>. The platform uses this
          opaque identifier to coordinate care for you across coalition partners. You can stop
          sharing with any partner at any time.
        </p>
      </header>

      <Card className="border-amber-500/40 bg-amber-500/5">
        <CardContent className="text-xs">
          <p className="font-medium">PHASE-1 STUB.</p>
          <p className="mt-1 text-muted-foreground">
            Real consent flow requires the data-trust governance described in{' '}
            <code className="font-mono">docs/research/Daviess_County_Pilot_Report.md</code> §5
            (consent-first individual data, abuser-blind protocols for DV) and a one-time-link or QR
            auth gate distributed by your caseworker. Today this page is reachable by anyone with
            the URL — that ships with INDC follow-up work.
          </p>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Coalition partners with your record</CardTitle>
        </CardHeader>
        <CardContent>
          {rows.length === 0 ? (
            <p className="text-sm text-muted-foreground">
              No partners on record for this identifier. If you expected something here, ask the
              caseworker who gave you this link to confirm the identifier.
            </p>
          ) : (
            <ul className="space-y-2">
              {rows.map((row) => (
                <ConsentRow
                  key={row.consentId ?? row.partnerOrgId}
                  syntheticPersonRef={ref}
                  summary={row}
                />
              ))}
            </ul>
          )}
        </CardContent>
      </Card>

      <p className="px-2 text-xs text-muted-foreground">
        Stopping sharing here marks your record as revoked-from-coordination at that partner; the
        partner still keeps their own service records (we don't have remote-delete). To ask a
        partner to delete their copy, contact them directly. If you want to re-engage later, ask
        your caseworker for a fresh sharing link.
      </p>
    </div>
  );
}
