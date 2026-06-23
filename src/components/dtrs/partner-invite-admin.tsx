'use client';

import { useRouter } from 'next/navigation';
import { useState, useTransition } from 'react';
import {
  invitePartnerAction,
  revokeInvitationAction,
  revokePartnerRoleAction,
} from '@/app/actions/partner-invitations';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';

export interface InvitationRow {
  id: string;
  invitedEmail: string;
  expiresAt: string;
  redeemedAt: string | null;
  revokedAt: string | null;
}
export interface PartnerRow {
  id: string;
  email: string;
}

const fmt = (iso: string | null) =>
  iso == null
    ? '—'
    : new Intl.DateTimeFormat('en-US', { dateStyle: 'medium' }).format(new Date(iso));

function invitationStatus(inv: InvitationRow): string {
  if (inv.revokedAt) return 'revoked';
  if (inv.redeemedAt) return 'redeemed';
  if (new Date(inv.expiresAt).getTime() <= Date.now()) return 'expired';
  return 'active';
}

export function PartnerInviteAdmin({
  invitations,
  partners,
}: {
  invitations: InvitationRow[];
  partners: PartnerRow[];
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [inviteLink, setInviteLink] = useState<string | null>(null);

  const sendInvite = (fd: FormData) => {
    setError(null);
    setInviteLink(null);
    startTransition(async () => {
      const r = await invitePartnerAction(fd);
      if (!r.ok) {
        setError(r.error);
        return;
      }
      const origin = typeof window !== 'undefined' ? window.location.origin : '';
      setInviteLink(`${origin}/app/invite/accept?token=${r.token}`);
      router.refresh();
    });
  };

  const run = (fn: () => Promise<{ ok: boolean; error?: string }>) => {
    setError(null);
    startTransition(async () => {
      const r = await fn();
      if (!r.ok) {
        setError(r.error ?? 'Action failed.');
        return;
      }
      router.refresh();
    });
  };

  return (
    <div className="space-y-6">
      {error ? <p className="text-destructive text-sm">{error}</p> : null}

      <form action={sendInvite} className="rounded-md border border-border p-4">
        <h2 className="mb-2 text-sm font-semibold">Invite an academic partner</h2>
        <div className="flex flex-wrap items-end gap-2">
          <div className="flex-1">
            <Label htmlFor="invitedEmail">Email</Label>
            <Input
              id="invitedEmail"
              name="invitedEmail"
              type="email"
              placeholder="researcher@university.edu"
              required
            />
          </div>
          <Button type="submit" size="sm" disabled={pending}>
            {pending ? 'Minting…' : 'Create invite'}
          </Button>
        </div>
        {inviteLink ? (
          <div className="mt-3 rounded-md border border-emerald-500/40 bg-emerald-500/5 p-2 text-xs">
            <p className="font-medium text-emerald-700 dark:text-emerald-400">
              Invite link (valid 7 days — share it with the invitee):
            </p>
            <code className="mt-1 block break-all font-mono">{inviteLink}</code>
          </div>
        ) : null}
      </form>

      <div className="space-y-2">
        <h2 className="text-sm font-semibold">Invitations ({invitations.length})</h2>
        {invitations.length === 0 ? (
          <p className="text-sm text-muted-foreground">No invitations yet.</p>
        ) : (
          <ul className="space-y-2">
            {invitations.map((inv) => {
              const status = invitationStatus(inv);
              return (
                <li
                  key={inv.id}
                  className="flex flex-wrap items-center justify-between gap-2 rounded-md border border-border bg-card p-3 text-sm"
                >
                  <div>
                    <p className="font-medium">{inv.invitedEmail}</p>
                    <p className="text-xs text-muted-foreground">
                      {status} · expires {fmt(inv.expiresAt)}
                      {inv.redeemedAt ? ` · redeemed ${fmt(inv.redeemedAt)}` : ''}
                    </p>
                  </div>
                  {status === 'active' ? (
                    <Button
                      size="sm"
                      variant="outline"
                      disabled={pending}
                      onClick={() => run(() => revokeInvitationAction(inv.id))}
                    >
                      Revoke
                    </Button>
                  ) : null}
                </li>
              );
            })}
          </ul>
        )}
      </div>

      <div className="space-y-2">
        <h2 className="text-sm font-semibold">Active academic partners ({partners.length})</h2>
        {partners.length === 0 ? (
          <p className="text-sm text-muted-foreground">No active academic partners.</p>
        ) : (
          <ul className="space-y-2">
            {partners.map((p) => (
              <li
                key={p.id}
                className="flex flex-wrap items-center justify-between gap-2 rounded-md border border-border bg-card p-3 text-sm"
              >
                <span className="font-medium">{p.email}</span>
                <Button
                  size="sm"
                  variant="destructive"
                  disabled={pending}
                  onClick={() => run(() => revokePartnerRoleAction(p.id))}
                >
                  Revoke access
                </Button>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}
