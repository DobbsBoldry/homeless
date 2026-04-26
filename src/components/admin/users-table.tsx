'use client';

import { useState, useTransition } from 'react';
import { demoteUserAction, promoteToKlaAttorneyAction } from '@/app/actions/admin';
import { Button } from '@/components/ui/button';
import type { UserAdminRow } from '@/db/queries/users';

const fmtDate = (d: Date) =>
  new Intl.DateTimeFormat('en-US', { dateStyle: 'medium' }).format(new Date(d));

const roleBadge: Record<string, string> = {
  pending: 'bg-muted text-muted-foreground',
  attorney: 'bg-primary text-primary-foreground',
  caseworker: 'bg-secondary text-secondary-foreground',
  ed_coordinator: 'bg-secondary text-secondary-foreground',
  shelter_staff: 'bg-secondary text-secondary-foreground',
  admin: 'bg-emerald-600/15 text-emerald-700 dark:text-emerald-400',
};

export function UsersTable({
  rows,
  currentUserId,
}: {
  rows: UserAdminRow[];
  currentUserId: string;
}) {
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  const onPromote = (id: string) => {
    setError(null);
    startTransition(async () => {
      const r = await promoteToKlaAttorneyAction(id);
      if (!r.ok) setError(r.error);
    });
  };

  const onDemote = (id: string) => {
    setError(null);
    startTransition(async () => {
      const r = await demoteUserAction(id);
      if (!r.ok) setError(r.error);
    });
  };

  return (
    <div className="space-y-2">
      {error ? <p className="text-destructive text-sm">{error}</p> : null}
      <div className="overflow-x-auto rounded-md border border-border">
        <table className="w-full text-sm">
          <thead className="bg-muted/40 text-left text-xs uppercase tracking-wide text-muted-foreground">
            <tr>
              <th className="px-3 py-2">Email</th>
              <th className="px-3 py-2">Name</th>
              <th className="px-3 py-2">Role</th>
              <th className="px-3 py-2">KLA member</th>
              <th className="px-3 py-2">Created</th>
              <th className="px-3 py-2 text-right">Actions</th>
            </tr>
          </thead>
          <tbody>
            {rows.map(({ user, isKlaMember }) => {
              const isSelf = user.id === currentUserId;
              const canPromote = !(user.role === 'attorney' && isKlaMember);
              const canDemote = user.role !== 'pending' && !isSelf;
              return (
                <tr key={user.id} className="border-t border-border align-top">
                  <td className="px-3 py-2 font-mono text-xs">{user.email}</td>
                  <td className="px-3 py-2">
                    {[user.firstName, user.lastName].filter(Boolean).join(' ') || (
                      <span className="text-muted-foreground">—</span>
                    )}
                  </td>
                  <td className="px-3 py-2">
                    <span
                      className={`rounded px-2 py-0.5 text-xs ${roleBadge[user.role] ?? 'bg-muted'}`}
                    >
                      {user.role}
                    </span>
                  </td>
                  <td className="px-3 py-2">
                    {isKlaMember ? (
                      <span className="text-emerald-600 dark:text-emerald-400">✓</span>
                    ) : (
                      <span className="text-muted-foreground">—</span>
                    )}
                  </td>
                  <td className="px-3 py-2 whitespace-nowrap text-xs text-muted-foreground">
                    {fmtDate(user.createdAt)}
                  </td>
                  <td className="px-3 py-2">
                    <div className="flex justify-end gap-2">
                      <Button
                        size="sm"
                        variant="outline"
                        disabled={pending || !canPromote}
                        onClick={() => onPromote(user.id)}
                        title={canPromote ? 'Promote to KLA attorney' : 'Already KLA attorney'}
                      >
                        Promote
                      </Button>
                      <Button
                        size="sm"
                        variant="ghost"
                        disabled={pending || !canDemote}
                        onClick={() => onDemote(user.id)}
                        title={isSelf ? "Can't demote yourself" : 'Demote to pending'}
                      >
                        Demote
                      </Button>
                    </div>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
