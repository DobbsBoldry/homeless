import { notFound } from 'next/navigation';
import { ConsentRow } from '@/components/consent/consent-row';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { listPersonPartnerSummary } from '@/db/queries/person-consents';
import { lookupConsentAccessToken } from '@/lib/dtrs';
import { isValidSyntheticPersonRef } from '@/lib/synthetic-person';

export const metadata = {
  title: 'Your sharing settings',
};

/**
 * Public consent management surface. Auth mirrors the grant surface
 * (`/p/[ref]/consent/grant`):
 *   1. Token mode: URL has `?token=<…>` matching the ref.
 *   2. Open mode: `INDC_CONSENT_OPEN_MODE=1` (dev/demo only).
 * Without one, return 404 — don't leak that the route exists.
 */
export default async function ConsentPage({
  params,
  searchParams,
}: {
  params: Promise<{ ref: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const { ref } = await params;
  const sp = await searchParams;
  if (!isValidSyntheticPersonRef(ref)) notFound();

  const rawToken = Array.isArray(sp.token) ? sp.token[0] : sp.token;
  const openMode = process.env.INDC_CONSENT_OPEN_MODE === '1';

  let authorized = false;
  if (rawToken) {
    const found = await lookupConsentAccessToken(rawToken);
    if (found && found.syntheticPersonRef === ref) authorized = true;
  } else if (openMode) {
    authorized = true;
  }
  if (!authorized) notFound();

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
                  accessToken={rawToken ?? null}
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

      {openMode ? (
        <Card className="border-amber-500/40 bg-amber-500/5">
          <CardContent className="text-xs">
            <p className="font-medium">Open mode is active.</p>
            <p className="mt-1 text-muted-foreground">
              <code className="font-mono">INDC_CONSENT_OPEN_MODE=1</code> is set, so this URL is
              reachable without a token. Used for staff demos. Disable in any environment that
              touches real callers.
            </p>
          </CardContent>
        </Card>
      ) : null}
    </div>
  );
}
