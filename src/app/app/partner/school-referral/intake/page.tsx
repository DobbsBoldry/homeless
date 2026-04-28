/**
 * PRVN-003 — School referral intake page for McKinney-Vento liaisons.
 *
 * Auth: any authenticated user who is an active member of a partner_org
 * with type='school'. The server verifies org membership — this is not
 * admin-only. The page renders the orgs the user belongs to so they can
 * select the correct school district if they serve multiple.
 */
import { and, eq } from 'drizzle-orm';
import { notFound } from 'next/navigation';
import { SchoolReferralIntakeForm } from '@/components/dtrs/school-referral-intake-form';
import { db } from '@/db/client';
import { orgMemberships } from '@/db/schema/org-memberships';
import { partnerOrgs } from '@/db/schema/partner-orgs';
import { requireUser } from '@/lib/auth';

export const dynamic = 'force-dynamic';

export default async function SchoolReferralIntakePage() {
  const user = await requireUser();

  // Find all school-type partner orgs this user is a member of.
  const schoolOrgs = await db
    .select({ id: partnerOrgs.id, name: partnerOrgs.name })
    .from(orgMemberships)
    .innerJoin(partnerOrgs, eq(orgMemberships.partnerOrgId, partnerOrgs.id))
    .where(
      and(
        eq(orgMemberships.userId, user.id),
        eq(partnerOrgs.type, 'school'),
        eq(partnerOrgs.active, true),
      ),
    );

  if (schoolOrgs.length === 0) {
    // Not a school org member — 404 (don't reveal the route exists to non-members).
    notFound();
  }

  return (
    <div className="mx-auto max-w-2xl space-y-4 p-4 md:p-6">
      <header>
        <h1 className="font-serif text-3xl font-bold text-primary">Student housing referral</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Submit a McKinney-Vento referral to connect a family with coalition housing services. All
          data is governed by FERPA — include only minimum-necessary information. No student last
          name or date of birth.
        </p>
      </header>

      <div className="rounded-md border border-amber-200 bg-amber-50 px-4 py-3 text-sm dark:border-amber-800/40 dark:bg-amber-900/10">
        <p className="font-medium text-amber-800 dark:text-amber-300">FERPA reminder</p>
        <p className="mt-1 text-amber-700 dark:text-amber-400">
          McKinney-Vento authorization covers only housing-related services for students
          experiencing homelessness. For any other disclosure, parental or eligible-student consent
          is required. A disclosure log will be created for every caseworker who accesses this
          referral (FERPA § 99.32).
        </p>
      </div>

      <SchoolReferralIntakeForm orgs={schoolOrgs} />
    </div>
  );
}
