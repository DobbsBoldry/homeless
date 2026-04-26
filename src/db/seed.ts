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
import {
  type NewRentalAssistanceProgram,
  rentalAssistancePrograms,
} from './schema/rental-assistance-programs';
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

  // ---- rental-assistance program catalog (EVDT-014) ----
  // SAMPLE catalog. Names are real KY agencies but contact info and
  // eligibility text are NOT independently verified — every entry is
  // prefixed [SAMPLE] in the UI so attorneys don't act on it before
  // a real catalog refresh ships. The UI banner reinforces this.
  // TODO: replace with verified catalog (and drop the [SAMPLE] prefix)
  //       before any KLA attorney sees this in production.
  // TODO: switch to upsert-by-(agency,name) once the catalog stabilizes
  //       so seed re-runs can update fields without resetting the table.
  const programs: NewRentalAssistanceProgram[] = [
    {
      name: '[SAMPLE] Healthy at Home Eviction Relief Fund',
      agency: 'Kentucky Housing Corporation (KHC)',
      phone: '+1-502-564-7630',
      website: 'https://www.kyhousing.org',
      eligibilitySummary:
        'Past-due rent and utilities for households at or below 80% AMI. Application via KHC; landlord cooperation typically required. Program reopens periodically as funding cycles allow.',
      maxAwardCents: null,
      sourceNote: 'KHC public site (illustrative wording, verify per cycle)',
    },
    {
      name: '[SAMPLE] Emergency Rental Assistance',
      agency: 'Audubon Area Community Services',
      phone: '+1-270-686-1600',
      website: 'https://www.audubon-area.com',
      eligibilitySummary:
        'Daviess and surrounding-county residents in housing crisis. Documentation typically required: lease, ID, income proof. Award amount and turnaround vary with funding.',
      maxAwardCents: 100000,
      sourceNote: 'Audubon Area program inventory (illustrative)',
    },
    {
      name: '[SAMPLE] Emergency Aid (Rent / Utilities)',
      agency: 'Catholic Charities of the Diocese of Owensboro',
      phone: '+1-270-683-1545',
      website: 'https://owensborodiocese.org/catholic-charities',
      eligibilitySummary:
        'One-time crisis assistance for Daviess-area households. No religious requirement. Walk-in intake at the office during published hours.',
      maxAwardCents: 50000,
      sourceNote: 'Diocese of Owensboro Catholic Charities (illustrative)',
    },
    {
      name: '[SAMPLE] Outreach Fund (Rent / Move-in / Utilities)',
      agency: 'Boulware Mission',
      phone: '+1-270-683-1505',
      website: 'https://www.boulwaremission.org',
      eligibilitySummary:
        'Crisis-intervention support for individuals at risk of homelessness. Often paired with case-management referral. Funding cycle dependent.',
      maxAwardCents: 30000,
      sourceNote: 'Boulware Mission (illustrative)',
    },
    {
      name: '[SAMPLE] TANF Family Crisis Funds',
      agency: 'Daviess County Department for Community Based Services (DCBS)',
      phone: '+1-270-687-7300',
      website: 'https://www.chfs.ky.gov/agencies/dcbs',
      eligibilitySummary:
        'Families with dependent children at or near TANF income thresholds. Application via DCBS office; documentation includes household composition and income.',
      maxAwardCents: null,
      sourceNote: 'KY DCBS family assistance (illustrative)',
    },
    {
      name: '[SAMPLE] 211 Resource Navigation',
      agency: 'United Way of the Ohio Valley',
      // 211 is dialed bare; do NOT prefix with +1.
      phone: '211',
      website: 'https://uw211.org',
      eligibilitySummary:
        'Not direct rental assistance — phone-based navigation to currently-funded local programs, food banks, utility assistance. First call when other funds are exhausted.',
      maxAwardCents: null,
      sourceNote: '211 standard service description',
    },
  ];

  const existingPrograms = await db
    .select({ name: rentalAssistancePrograms.name })
    .from(rentalAssistancePrograms)
    .limit(1);
  if (existingPrograms.length === 0) {
    await db.insert(rentalAssistancePrograms).values(programs);
    console.log(`[seed]   + ${programs.length} rental-assistance programs`);
  } else {
    console.log('[seed]   = rental-assistance programs (exist)');
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
