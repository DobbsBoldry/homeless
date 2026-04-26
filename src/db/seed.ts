/**
 * Idempotent dev seed script. Run with: `pnpm db:seed`
 *
 * Creates a baseline of fixture data so the app is usable end-to-end without
 * Clerk-signed-in users. SAFE to re-run — uses ON CONFLICT DO NOTHING for
 * external identifiers and counts existing rows for idempotency.
 *
 * NEVER load real PHI here. This is synthetic / placeholder data only.
 */
import { config } from 'dotenv';
import { eq } from 'drizzle-orm';
import { db } from './client';
import { auditLog } from './schema/audit-log';
import type { UserRole } from './schema/enums';
import { orgMemberships } from './schema/org-memberships';
import { partnerOrgs } from './schema/partner-orgs';
import { users } from './schema/users';

config({ path: ['.env.local', '.env'] });

async function main() {
  console.log('[seed] starting…');

  // ---- partner orgs ----
  const orgSlug = 'audubon-area-community-services';
  let [org] = await db.select().from(partnerOrgs).where(eq(partnerOrgs.slug, orgSlug)).limit(1);
  if (!org) {
    [org] = await db
      .insert(partnerOrgs)
      .values({
        name: 'Audubon Area Community Services',
        slug: orgSlug,
        type: 'community_org',
        contactEmail: 'info@audubon-area.example',
        contactPhone: '+1-270-555-0100',
      })
      .returning();
    console.log('[seed]   + partner org', org.slug);
  } else {
    console.log('[seed]   = partner org', org.slug, '(exists)');
  }

  // KLA Owensboro — legal aid partner. Membership in this org gates
  // the attorney-only views (see requireKlaAttorney in src/lib/auth.ts).
  const klaSlug = 'kla-owensboro';
  let [klaOrg] = await db.select().from(partnerOrgs).where(eq(partnerOrgs.slug, klaSlug)).limit(1);
  if (!klaOrg) {
    [klaOrg] = await db
      .insert(partnerOrgs)
      .values({
        name: 'Kentucky Legal Aid - Owensboro',
        slug: klaSlug,
        type: 'legal_aid',
        contactEmail: 'owensboro@klaid.example',
        contactPhone: '+1-270-555-0200',
      })
      .returning();
    console.log('[seed]   + partner org', klaOrg.slug);
  } else {
    console.log('[seed]   = partner org', klaOrg.slug, '(exists)');
  }

  // ---- 5 users, one per role ----
  const sampleUsers: Array<{ role: UserRole; email: string; firstName: string; lastName: string }> =
    [
      {
        role: 'attorney',
        email: 'attorney+seed@example.test',
        firstName: 'Ada',
        lastName: 'Attorney',
      },
      {
        role: 'caseworker',
        email: 'caseworker+seed@example.test',
        firstName: 'Carl',
        lastName: 'Caseworker',
      },
      {
        role: 'ed_coordinator',
        email: 'edcoord+seed@example.test',
        firstName: 'Eve',
        lastName: 'Coordinator',
      },
      {
        role: 'shelter_staff',
        email: 'shelter+seed@example.test',
        firstName: 'Sam',
        lastName: 'Shelter',
      },
      { role: 'admin', email: 'admin+seed@example.test', firstName: 'Alex', lastName: 'Admin' },
    ];

  for (const u of sampleUsers) {
    const fakeClerkId = `seed_${u.role}`;
    const [existing] = await db
      .select()
      .from(users)
      .where(eq(users.clerkUserId, fakeClerkId))
      .limit(1);
    let user = existing;
    if (!user) {
      [user] = await db
        .insert(users)
        .values({
          clerkUserId: fakeClerkId,
          email: u.email,
          firstName: u.firstName,
          lastName: u.lastName,
          role: u.role,
        })
        .returning();
      console.log('[seed]   + user', u.role, user.email);
    } else {
      console.log('[seed]   = user', u.role, user.email, '(exists)');
    }

    // Org membership in the default community org for every seed user.
    await db
      .insert(orgMemberships)
      .values({ userId: user.id, partnerOrgId: org.id, role: u.role })
      .onConflictDoNothing({
        target: [orgMemberships.userId, orgMemberships.partnerOrgId],
      });

    // Attorneys also get KLA Owensboro membership so they can access the
    // KLA-only views (requireKlaAttorney).
    if (u.role === 'attorney') {
      await db
        .insert(orgMemberships)
        .values({ userId: user.id, partnerOrgId: klaOrg.id, role: 'attorney' })
        .onConflictDoNothing({
          target: [orgMemberships.userId, orgMemberships.partnerOrgId],
        });
    }
  }

  // ---- 3 sample audit entries ----
  const existingAudits = await db.select({ action: auditLog.action }).from(auditLog).limit(1);
  if (existingAudits.length === 0) {
    const [adminUser] = await db
      .select()
      .from(users)
      .where(eq(users.clerkUserId, 'seed_admin'))
      .limit(1);
    await db.insert(auditLog).values([
      {
        actorUserId: adminUser?.id ?? null,
        action: 'partner_org.created',
        targetTable: 'partner_orgs',
        targetId: org.id,
        metadata: { source: 'seed' },
      },
      {
        actorUserId: adminUser?.id ?? null,
        action: 'org_membership.added',
        targetTable: 'org_memberships',
        metadata: { source: 'seed', count: sampleUsers.length },
      },
      {
        actorUserId: adminUser?.id ?? null,
        action: 'system.seed_completed',
        metadata: { source: 'seed', at: new Date().toISOString() },
      },
    ]);
    console.log('[seed]   + 3 audit entries');
  } else {
    console.log('[seed]   = audit entries (exist)');
  }

  console.log('[seed] done.');
  process.exit(0);
}

main().catch((err) => {
  console.error('[seed] failed', err);
  process.exit(1);
});
