import { notFound } from 'next/navigation';
import { ConsentForm } from '@/components/consent/consent-form';
import { Card, CardContent } from '@/components/ui/card';
import { type ConsentType, consentTypeEnum } from '@/db/schema/enums';
import { consentTextFor } from '@/lib/dtrs/consent-text';
import { lookupConsentAccessToken } from '@/lib/dtrs/consent-token';
import { isValidSyntheticPersonRef } from '@/lib/synthetic-person';

export const metadata = {
  title: 'Sharing agreement',
};

const VALID_TYPES = new Set<ConsentType>(consentTypeEnum.enumValues);

/**
 * Public consent grant surface. Two access modes:
 *   1. Token mode (preferred, post-#251): URL has `?token=<opaque>`
 *      and the token resolves server-side to the ref. Phase-1 prod use.
 *   2. Open mode (legacy, demo only): no token, but the URL itself
 *      is the secret. Locked behind INDC_CONSENT_OPEN_MODE=1 so we
 *      don't accidentally ship open-mode to a real domain.
 *
 * If neither path validates, return 404 — don't leak that the route
 * pattern exists.
 */
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

  const rawToken = Array.isArray(sp.token) ? sp.token[0] : sp.token;
  const openMode = process.env.INDC_CONSENT_OPEN_MODE === '1';

  // Page render uses LOOKUP (no side effect) — `used_at` is stamped only
  // when the form is actually submitted via the server action's
  // redeemConsentAccessToken call. This keeps "viewed but didn't submit"
  // distinguishable in analytics.
  let authorized = false;
  if (rawToken) {
    const found = await lookupConsentAccessToken(rawToken);
    if (found && found.syntheticPersonRef === ref) {
      authorized = true;
    }
  } else if (openMode) {
    authorized = true;
  }

  if (!authorized) notFound();

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
          <ConsentForm
            subjectExternalId={ref}
            consentType={consentType}
            copy={copy}
            accessToken={rawToken ?? null}
          />
        </CardContent>
      </Card>

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
