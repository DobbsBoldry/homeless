import { InviteAcceptClient } from '@/components/dtrs/invite-accept-client';
import { requireUser } from '@/lib/auth';

export const dynamic = 'force-dynamic';

/**
 * DTRS-014a-1 — academic-partner invitation accept surface. Any signed-in user
 * may redeem (a freshly-signed-up invitee lands here via the invite link).
 * requireUser() bounces unauthenticated visitors to sign-in, then back here.
 */
export default async function InviteAcceptPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  await requireUser();
  const sp = await searchParams;
  const token = (Array.isArray(sp.token) ? sp.token[0] : sp.token)?.trim() ?? '';

  return (
    <div className="mx-auto max-w-lg space-y-4 p-6">
      <header>
        <h1 className="font-serif text-2xl font-bold text-primary">
          Accept academic-partner invite
        </h1>
        <p className="text-sm text-muted-foreground">
          Accepting grants your account read-only access to the coalition's aggregate, de-identified
          outcomes — no individual records.
        </p>
      </header>
      {token ? (
        <InviteAcceptClient token={token} />
      ) : (
        <p className="rounded-md border border-amber-500/40 bg-amber-500/5 p-3 text-sm">
          This link is missing its invitation token. Ask your coalition contact for a fresh invite
          link.
        </p>
      )}
    </div>
  );
}
