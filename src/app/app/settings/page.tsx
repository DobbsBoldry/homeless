import { eq } from 'drizzle-orm';
import Link from 'next/link';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { db } from '@/db/client';
import type { UserRole } from '@/db/schema/enums';
import { orgMemberships } from '@/db/schema/org-memberships';
import { partnerOrgs } from '@/db/schema/partner-orgs';
import { requireUser } from '@/lib/auth';

export const dynamic = 'force-dynamic';

const ROLE_LABEL: Record<UserRole, string> = {
  pending: 'Pending — awaiting role assignment',
  attorney: 'Attorney',
  caseworker: 'Caseworker',
  ed_coordinator: 'ED coordinator',
  shelter_staff: 'Shelter staff',
  admin: 'Admin',
  academic_partner: 'Academic partner',
};

const ROLE_DESCRIPTION: Record<UserRole, string> = {
  pending:
    'An admin will assign your role; only the dashboard and coalition directory are visible.',
  attorney:
    'Daily eviction-defense queue, response packets, outcome tracking. KLA membership unlocks the queue.',
  caseworker: 'Cross-agency coordination view, benefits screener, triage tier, consent tools.',
  ed_coordinator: 'ED super-utilizer queue, AI care plans, care-coordinator workflow.',
  shelter_staff: 'Bed-count updates, bed availability board, SMS bed-finder playground.',
  admin: 'Everything plus user management, audit log, SMS metrics.',
  academic_partner:
    'Read-only access to aggregate, de-identified coalition outcomes — no individual records.',
};

export default async function SettingsPage() {
  const user = await requireUser();
  const memberships = await db
    .select({
      id: orgMemberships.id,
      role: orgMemberships.role,
      partnerOrg: { name: partnerOrgs.name, slug: partnerOrgs.slug },
    })
    .from(orgMemberships)
    .innerJoin(partnerOrgs, eq(orgMemberships.partnerOrgId, partnerOrgs.id))
    .where(eq(orgMemberships.userId, user.id));

  return (
    <div className="mx-auto max-w-3xl space-y-4 p-6">
      <header>
        <h1 className="font-serif text-3xl font-bold text-primary">Settings</h1>
        <p className="text-sm text-muted-foreground">
          Account, role, and organization memberships.
        </p>
      </header>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Account</CardTitle>
        </CardHeader>
        <CardContent>
          <dl className="grid gap-x-4 gap-y-2 text-sm sm:grid-cols-[max-content,1fr]">
            <dt className="text-muted-foreground">Name</dt>
            <dd>
              {[user.firstName, user.lastName].filter(Boolean).join(' ') || (
                <span className="text-muted-foreground">— (set via your sign-in provider)</span>
              )}
            </dd>
            <dt className="text-muted-foreground">Email</dt>
            <dd className="font-mono text-xs">{user.email}</dd>
            <dt className="text-muted-foreground">Member since</dt>
            <dd className="font-mono text-xs">{user.createdAt.toISOString().slice(0, 10)}</dd>
          </dl>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Role</CardTitle>
        </CardHeader>
        <CardContent className="space-y-2 text-sm">
          <p className="font-medium">{ROLE_LABEL[user.role]}</p>
          <p className="text-muted-foreground">{ROLE_DESCRIPTION[user.role]}</p>
          {user.role === 'pending' ? (
            <p className="text-xs text-muted-foreground">
              Reach out to a coalition admin to get a role assigned.
            </p>
          ) : null}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Organization memberships</CardTitle>
        </CardHeader>
        <CardContent>
          {memberships.length === 0 ? (
            <p className="text-sm text-muted-foreground">
              You're not a member of any partner org. Some surfaces (KLA daily queue) require
              membership in a specific org and will appear locked until an admin adds you.
            </p>
          ) : (
            <ul className="divide-y divide-border text-sm">
              {memberships.map((m) => (
                <li key={m.id} className="flex items-baseline justify-between gap-2 py-2">
                  <span>{m.partnerOrg.name}</span>
                  <span className="font-mono text-xs text-muted-foreground">{m.role}</span>
                </li>
              ))}
            </ul>
          )}
        </CardContent>
      </Card>

      <Card className="border-amber-500/40 bg-amber-500/5">
        <CardContent className="text-xs">
          <p className="font-medium">Need to change something?</p>
          <p className="mt-1 text-muted-foreground">
            Sign-in identity (name, email, password) is managed through your sign-in provider —
            update it there. Role and org membership changes go through a coalition admin (
            <Link href="/app/admin/users" className="underline hover:text-foreground">
              user management
            </Link>{' '}
            for admins).
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
