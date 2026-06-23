'use client';

import { useState, useTransition } from 'react';
import { regrantConsentAction, revokeConsentAction } from '@/app/actions/consent';
import { Button } from '@/components/ui/button';
import type { PersonPartnerSummary } from '@/db/queries/person-consents';

const fmtDate = (d: Date | null) =>
  d == null
    ? '—'
    : new Intl.DateTimeFormat('en-US', { dateStyle: 'medium', timeStyle: 'short' }).format(
        new Date(d),
      );

export function ConsentRow({
  syntheticPersonRef,
  summary,
  accessToken,
}: {
  syntheticPersonRef: string;
  summary: PersonPartnerSummary;
  /** Forwarded to the server action — the action is the auth boundary. */
  accessToken?: string | null;
}) {
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const isRevoked = summary.revokedAt != null;

  const onClick = () => {
    setError(null);
    if (!summary.consentId) return;
    startTransition(async () => {
      const action = isRevoked ? regrantConsentAction : revokeConsentAction;
      const r = await action(syntheticPersonRef, summary.consentId!, accessToken ?? null);
      if (!r.ok) setError(r.error);
    });
  };

  return (
    <li className="rounded-md border border-border bg-card p-3 text-sm">
      <div className="mb-1 flex flex-wrap items-baseline justify-between gap-2">
        <p className="font-medium">{summary.partnerName}</p>
        {isRevoked ? (
          <span className="rounded bg-destructive/15 px-2 py-0.5 text-xs text-destructive">
            Revoked {fmtDate(summary.revokedAt)}
          </span>
        ) : (
          <span className="rounded bg-emerald-600/15 px-2 py-0.5 text-xs text-emerald-700 dark:text-emerald-400">
            Sharing on
          </span>
        )}
      </div>
      <p className="text-xs text-muted-foreground">
        {summary.eventCount === 0
          ? 'No service events on file.'
          : `${summary.eventCount} service event${summary.eventCount === 1 ? '' : 's'} on file · most recent ${fmtDate(summary.latestEventAt)}${
              summary.latestEventType ? ` (${summary.latestEventType})` : ''
            }`}
      </p>
      {summary.consentEvents.length > 0 ? (
        <ul className="mt-1 space-y-0.5">
          {summary.consentEvents.map((e) => (
            <li
              key={`${e.eventType}-${new Date(e.eventAt).toISOString()}`}
              className="text-[10px] uppercase tracking-wide text-muted-foreground"
            >
              {e.label} {fmtDate(e.eventAt)}
            </li>
          ))}
        </ul>
      ) : (
        <p className="mt-1 text-[10px] uppercase tracking-wide text-muted-foreground">
          Consent granted {fmtDate(summary.grantedAt)}
        </p>
      )}
      <div className="mt-2 flex items-center gap-3">
        <Button
          size="sm"
          variant={isRevoked ? 'outline' : 'ghost'}
          disabled={pending || !summary.consentId}
          onClick={onClick}
        >
          {pending ? '…' : isRevoked ? 'Re-grant sharing' : 'Stop sharing with this partner'}
        </Button>
        {error ? <span className="text-destructive text-xs">{error}</span> : null}
      </div>
    </li>
  );
}
