import Link from 'next/link';
import { notFound } from 'next/navigation';
import { PreMeetingSummary } from '@/components/cwt/pre-meeting-summary';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { getPersonProfile } from '@/db/queries/person-profile';
import { requireRole } from '@/lib/auth';
import { recordDataAccess } from '@/lib/dtrs/data-access';
import { isValidSyntheticPersonRef } from '@/lib/synthetic-person';

export const dynamic = 'force-dynamic';

const ROLES = ['caseworker', 'shelter_staff', 'ed_coordinator', 'admin'] as const;

const fmtDate = (d: Date | string | null) => {
  if (d == null) return '—';
  return new Intl.DateTimeFormat('en-US', { dateStyle: 'medium' }).format(new Date(d));
};

const fmtDateTime = (d: Date) =>
  new Intl.DateTimeFormat('en-US', { dateStyle: 'medium', timeStyle: 'short' }).format(new Date(d));

export default async function PersonProfilePage({ params }: { params: Promise<{ ref: string }> }) {
  const me = await requireRole(ROLES);
  const { ref } = await params;
  if (!isValidSyntheticPersonRef(ref)) notFound();

  const profile = await getPersonProfile(ref);

  await recordDataAccess({
    actorUserId: me.id,
    resourceType: 'person_profile',
    resourceId: ref,
    purpose: 'caseworker_unified_view',
    metadata: {
      eventCount: profile.serviceEvents.length,
      consentCount: profile.consents.length,
      intakeCount: profile.intakes.length,
      documentCount: profile.documents.length,
    },
  });

  const empty =
    profile.serviceEvents.length === 0 &&
    profile.consents.length === 0 &&
    profile.intakes.length === 0 &&
    profile.documents.length === 0;

  return (
    <div className="mx-auto max-w-4xl space-y-4 p-4 md:p-6">
      <div className="text-xs">
        <Link href="/app/clients" className="text-muted-foreground hover:underline">
          ← Back to clients
        </Link>
      </div>

      <header>
        <p className="text-xs uppercase tracking-wide text-muted-foreground">Person profile</p>
        <h1 className="font-serif text-3xl font-bold text-primary">
          <span className="font-mono">{ref}</span>
        </h1>
        <p className="text-sm text-muted-foreground">
          Unified per-person view across coalition partners. Identifier is opaque; the platform
          never holds the mapping to a real name. {profile.serviceEvents.length} service event
          {profile.serviceEvents.length === 1 ? '' : 's'} · {profile.consents.length} partner
          consent
          {profile.consents.length === 1 ? '' : 's'} · {profile.intakes.length} intake
          {profile.intakes.length === 1 ? '' : 's'} · {profile.documents.length} document
          {profile.documents.length === 1 ? '' : 's'}.
        </p>
      </header>

      {empty ? (
        <Card>
          <CardContent className="text-sm text-muted-foreground">
            No coalition records for this identifier. Either it's brand-new (no partners have
            recorded an event yet) or the ref is wrong. Cross-check with the caseworker who shared
            the link.
          </CardContent>
        </Card>
      ) : null}

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Pre-meeting briefing</CardTitle>
        </CardHeader>
        <CardContent>
          <PreMeetingSummary syntheticPersonRef={ref} />
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">
            Cross-org service events ({profile.serviceEvents.length})
          </CardTitle>
        </CardHeader>
        <CardContent>
          {profile.serviceEvents.length === 0 ? (
            <p className="text-sm text-muted-foreground">No partner service events recorded.</p>
          ) : (
            <ul className="divide-y divide-border text-sm">
              {profile.serviceEvents.map((e) => (
                <li key={e.id} className="flex flex-wrap items-baseline justify-between gap-2 py-2">
                  <span>
                    <span className="font-medium">{e.partnerOrgName}</span>
                    <span className="text-muted-foreground"> · {e.eventType}</span>
                  </span>
                  <span className="whitespace-nowrap text-xs text-muted-foreground">
                    {fmtDate(e.eventAt)}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Partner consents ({profile.consents.length})</CardTitle>
        </CardHeader>
        <CardContent>
          {profile.consents.length === 0 ? (
            <p className="text-sm text-muted-foreground">
              No partner consents on record. Ask the client to grant via{' '}
              <code className="font-mono">/p/{ref}/consent/grant</code> (caseworker mints the
              token).
            </p>
          ) : (
            <ul className="divide-y divide-border text-sm">
              {profile.consents.map((c) => {
                const isRevoked = c.revokedAt != null;
                return (
                  <li
                    key={c.id}
                    className="flex flex-wrap items-baseline justify-between gap-2 py-2"
                  >
                    <span>
                      <span className="font-medium">{c.partnerOrgName}</span>
                      {isRevoked ? (
                        <span className="ml-2 rounded bg-destructive/15 px-2 py-0.5 text-xs text-destructive">
                          revoked {fmtDate(c.revokedAt)}
                        </span>
                      ) : (
                        <span className="ml-2 rounded bg-emerald-600/15 px-2 py-0.5 text-xs text-emerald-700 dark:text-emerald-400">
                          sharing
                        </span>
                      )}
                    </span>
                    <span className="whitespace-nowrap text-xs text-muted-foreground">
                      granted {fmtDate(c.grantedAt)}
                    </span>
                  </li>
                );
              })}
            </ul>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Voice intakes ({profile.intakes.length})</CardTitle>
        </CardHeader>
        <CardContent>
          {profile.intakes.length === 0 ? (
            <p className="text-sm text-muted-foreground">
              No intakes for this identifier yet. Record one at{' '}
              <Link href="/app/clients/intakes/new" className="text-primary hover:underline">
                /app/clients/intakes/new
              </Link>
              .
            </p>
          ) : (
            <ul className="divide-y divide-border text-sm">
              {profile.intakes.map((i) => (
                <li key={i.id} className="flex flex-wrap items-baseline justify-between gap-2 py-2">
                  <Link
                    href={`/app/clients/intakes/${i.id}`}
                    className="font-medium hover:underline"
                  >
                    {i.label}
                  </Link>
                  <span className="text-xs text-muted-foreground">
                    {fmtDateTime(i.createdAt)} · status <strong>{i.status}</strong>
                  </span>
                </li>
              ))}
            </ul>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Documents ({profile.documents.length})</CardTitle>
        </CardHeader>
        <CardContent>
          {profile.documents.length === 0 ? (
            <p className="text-sm text-muted-foreground">
              No documents linked to this identifier yet.
            </p>
          ) : (
            <ul className="divide-y divide-border text-sm">
              {profile.documents.map((d) => (
                <li key={d.id} className="flex flex-wrap items-baseline justify-between gap-2 py-2">
                  <Link
                    href={`/app/clients/documents/${d.id}`}
                    className="font-medium hover:underline"
                  >
                    {d.label}
                  </Link>
                  <span className="text-xs text-muted-foreground">
                    {d.kind} · {fmtDateTime(d.createdAt)} · status <strong>{d.status}</strong>
                  </span>
                </li>
              ))}
            </ul>
          )}
        </CardContent>
      </Card>

      <Card className="border-amber-500/40 bg-amber-500/5">
        <CardContent className="text-xs">
          <p className="font-medium">Phase-1 scope.</p>
          <p className="mt-1 text-muted-foreground">
            Eviction filings, ED encounters, and care plans aren't joined here yet — they're keyed
            on different identifiers (defendant name + DOB; opaque patient hash). Cross-table joins
            land with the data-trust steward (DTRS-014). For now, look those up by their own
            surfaces.
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
