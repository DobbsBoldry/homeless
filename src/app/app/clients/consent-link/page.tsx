import { ConsentTokenMinter } from '@/components/consent/consent-token-minter';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { requireRole } from '@/lib/auth';

export const dynamic = 'force-dynamic';

export default async function ConsentLinkPage() {
  await requireRole(['caseworker', 'shelter_staff', 'admin']);

  return (
    <div className="mx-auto max-w-2xl space-y-4 p-4 md:p-6">
      <header>
        <h1 className="font-serif text-3xl font-bold text-primary">Consent link</h1>
        <p className="text-sm text-muted-foreground">
          Mint a 24-hour single-resource link a client can use to grant or revoke their sharing
          settings. The token resolves server-side; nobody can change a client's settings without
          one.
        </p>
      </header>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Mint a link</CardTitle>
        </CardHeader>
        <CardContent>
          <ConsentTokenMinter />
        </CardContent>
      </Card>

      <Card className="border-amber-500/40 bg-amber-500/5">
        <CardContent className="text-xs">
          <p className="font-medium">Don't share these links over public channels.</p>
          <p className="mt-1 text-muted-foreground">
            A leaked link grants 24h of write access to one client's settings. Hand it to the person
            directly (printed wallet card, in-shelter QR), or message it on a channel only they can
            see. If you suspect a leak, mint a new one — older tokens stay valid until their expiry
            but you can also revoke a token via the database.
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
