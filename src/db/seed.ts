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
import { type NewPartnerOrg, partnerOrgs } from './schema/partner-orgs';
import { type NewPartnerServiceEvent, partnerServiceEvents } from './schema/partner-service-events';
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
        website: 'https://www.kyjustice.org/county/daviess',
        description:
          'Civil legal aid for low-income Daviess residents. Phase-1 pilot partner for the eviction-defense triage workflow.',
        dataSharingTier: 'individual',
      })
      .returning();
    console.log('[seed]   + partner org', klaOrg.slug);
  } else {
    console.log('[seed]   = partner org', klaOrg.slug, '(exists)');
  }

  // ---- coalition catalog (COAL-001) ----
  // Stakeholders catalogued in docs/research/Daviess_County_Pilot_Report.md.
  // Names + websites are real (public sources); we deliberately omit
  // phone numbers unless verified. data_sharing_tier defaults to 'none'
  // until coalition agreements raise it.
  const coalitionOrgs: NewPartnerOrg[] = [
    // Shelter providers
    {
      name: 'Boulware Mission, Inc.',
      slug: 'boulware-mission',
      type: 'shelter',
      website: 'https://www.boulwaremission.org',
      description:
        'Emergency and long-term shelter for homeless men and women across the seven-county Green River region.',
      dataSharingTier: 'none',
    },
    {
      name: "St. Benedict's Homeless Shelter",
      slug: 'st-benedicts-shelter',
      type: 'shelter',
      website: 'https://stbenedictsowensboro.org',
      description:
        'Christian-mission 24/7 shelter for 64 men nightly + day shelter for ~40 women and families. ~500 served annually.',
      dataSharingTier: 'none',
    },
    {
      name: 'Daniel Pitino Shelter',
      slug: 'daniel-pitino-shelter',
      type: 'shelter',
      website: 'https://pitinoshelter.org',
      description:
        '22,000 sq ft emergency and transitional housing for women, women with children, and families.',
      dataSharingTier: 'none',
    },
    {
      name: 'OASIS Shelter',
      slug: 'oasis-shelter',
      type: 'shelter',
      description:
        "Domestic-violence program AND licensed women's substance-use treatment. Location-confidential by design — coalition data design uses abuser-blind protocols here.",
      dataSharingTier: 'none',
    },
    {
      name: 'CrossRoads to Hope',
      slug: 'crossroads-to-hope',
      type: 'shelter',
      website: 'https://crossroadsowensboro.org',
      description:
        'The only walk-in emergency overnight shelter for women and children in Daviess County.',
      dataSharingTier: 'none',
    },
    {
      name: 'St. Joseph Peace Mission for Children',
      slug: 'st-joseph-peace-mission',
      type: 'shelter',
      description: 'Licensed emergency shelter for children. Designated Safe Place site.',
      dataSharingTier: 'none',
    },
    // Faith-based ecosystem
    {
      name: 'Catholic Charities of the Diocese of Owensboro',
      slug: 'catholic-charities-owensboro',
      type: 'faith_based',
      website: 'https://owensborodiocese.org/catholic-charities',
      description:
        'Coordinates parish-level social services across 32 western-KY counties. Operates Feeding Our Friends, Gerard Life Home, immigration legal services, disaster relief.',
      dataSharingTier: 'none',
    },
    {
      name: 'Aid the Homeless, Inc.',
      slug: 'aid-the-homeless',
      type: 'faith_based',
      website: 'https://aidthehomeless.org',
      description: 'Umbrella organization supporting multiple Owensboro shelters.',
      dataSharingTier: 'none',
    },
    {
      name: 'Volunteer Owensboro',
      slug: 'volunteer-owensboro',
      type: 'community_org',
      description: 'Volunteer mobilization infrastructure across Daviess-area nonprofits.',
      dataSharingTier: 'none',
    },
    // Healthcare
    {
      name: 'Owensboro Health',
      slug: 'owensboro-health',
      type: 'hospital',
      website: 'https://www.owensborohealth.org',
      description:
        'Dominant regional health system. Phase-1 pilot partner for ED super-utilizer care coordination via TEAMKY HRSN reimbursement.',
      dataSharingTier: 'none',
    },
    {
      name: 'Green River District Health Department',
      slug: 'green-river-health-dept',
      type: 'public_health',
      description:
        'County/regional public health authority. Under-leveraged data + coordination partner.',
      dataSharingTier: 'none',
    },
    // Government
    {
      name: 'Daviess County Fiscal Court',
      slug: 'daviess-fiscal-court',
      type: 'government',
      website: 'https://www.daviessky.org/elected-officials/fiscal-court',
      description:
        'County government. Judge-Executive Charlie Castlen + 3 commissioners. Controls county appropriations.',
      dataSharingTier: 'none',
    },
    {
      name: 'City of Owensboro',
      slug: 'city-of-owensboro',
      type: 'government',
      description:
        'Municipal government. Housing-code enforcement, zoning, public-safety partnerships with homeless outreach.',
      dataSharingTier: 'none',
    },
    {
      name: 'Green River Area Development District (GRADD)',
      slug: 'gradd',
      type: 'government',
      description:
        'Regional planning entity covering Daviess + 6 neighboring counties. Path to multi-county scale-out.',
      dataSharingTier: 'none',
    },
    {
      name: 'Kentucky Housing Corporation (KHC)',
      slug: 'khc',
      type: 'government',
      website: 'https://www.kyhousing.org',
      description:
        'State-level Balance-of-State CoC administrator. Runs HMIS for Daviess providers; sets state data standards.',
      dataSharingTier: 'none',
    },
    {
      name: 'Daviess District Court',
      slug: 'daviess-district-court',
      type: 'government',
      description:
        'Handles forcible-detainer (eviction) proceedings AND HB 5 unlawful-camping citations. Data source for the eviction-defense triage flow.',
      dataSharingTier: 'aggregate',
    },
    // Schools
    {
      name: 'Daviess County Public Schools',
      slug: 'daviess-county-public-schools',
      type: 'school',
      description:
        'Maintains a federally-funded McKinney-Vento homeless-student liaison. Earliest-warning data source for family instability.',
      dataSharingTier: 'none',
    },
    {
      name: 'Owensboro Independent Schools',
      slug: 'owensboro-independent-schools',
      type: 'school',
      description:
        'Independent district covering city of Owensboro. McKinney-Vento liaison; same Phase-2 data-flow as Daviess County Public Schools.',
      dataSharingTier: 'none',
    },
    // Education
    {
      name: 'Brescia University',
      slug: 'brescia-university',
      type: 'education',
      description:
        'Small Catholic (Ursuline) university with a strong social-work program. Candidate neutral steward for the data trust.',
      dataSharingTier: 'none',
    },
    {
      name: 'Kentucky Wesleyan College',
      slug: 'kentucky-wesleyan',
      type: 'education',
      description: 'Liberal arts college in Owensboro.',
      dataSharingTier: 'none',
    },
    {
      name: 'Owensboro Community & Technical College (OCTC)',
      slug: 'octc',
      type: 'education',
      description: 'Workforce-development partner. Candidate host for a neutral data intermediary.',
      dataSharingTier: 'none',
    },
    // Philanthropy
    {
      name: 'Public Life Foundation of Owensboro (PLFO)',
      slug: 'plfo',
      type: 'philanthropy',
      website: 'http://www.plfo.org',
      description:
        'Civic-convening foundation. Recommended Phase-0 convener / fiscal sponsor for the coalition.',
      dataSharingTier: 'none',
    },
    {
      name: 'Owensboro Health Community Health Investments',
      slug: 'oh-community-health-investments',
      type: 'philanthropy',
      website: 'https://www.owensborohealth.org/about/grants',
      description:
        "Owensboro Health's grantmaking arm. Mini-grants up to $2,500 across an 18-county region; SDOH-strategy framing.",
      dataSharingTier: 'none',
    },
    // Media
    {
      name: 'Messenger-Inquirer',
      slug: 'messenger-inquirer',
      type: 'media',
      description:
        'Daily newspaper of record for Owensboro. Coalition narrative + visibility channel.',
      dataSharingTier: 'none',
    },
    {
      name: 'Owensboro Times',
      slug: 'owensboro-times',
      type: 'media',
      description: 'Digital-native local news; covers civic and nonprofit stories.',
      dataSharingTier: 'none',
    },
  ];

  for (const candidate of coalitionOrgs) {
    const [existing] = await db
      .select({ slug: partnerOrgs.slug })
      .from(partnerOrgs)
      .where(eq(partnerOrgs.slug, candidate.slug))
      .limit(1);
    if (!existing) {
      await db.insert(partnerOrgs).values(candidate);
      console.log('[seed]   + coalition org', candidate.slug);
    }
  }
  console.log(`[seed]   = ${coalitionOrgs.length} coalition orgs verified`);

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

  // ---- COAL-002: synthetic cross-org service events ----
  // Demonstrates the 'this person asked 3 ministries this week' view
  // without any real cross-org data flow. Every synthetic_person_ref
  // is opaque (SYN-PERSON-*), and the events are spread across a
  // small set of seeded partner orgs to make the coordination view
  // demo-able. Phase 2 replaces this with real partner ingest.
  const existingEvents = await db
    .select({ id: partnerServiceEvents.id })
    .from(partnerServiceEvents)
    .limit(1);
  if (existingEvents.length === 0) {
    const eventOrgs = await db
      .select({ id: partnerOrgs.id, slug: partnerOrgs.slug })
      .from(partnerOrgs);
    const orgIdBySlug = new Map(eventOrgs.map((o) => [o.slug, o.id]));

    // 8 synthetic persons. Some appear at multiple orgs (the
    // coordination story), some at only one (typical population).
    const persons = [
      'SYN-PERSON-001',
      'SYN-PERSON-002',
      'SYN-PERSON-003',
      'SYN-PERSON-004',
      'SYN-PERSON-005',
      'SYN-PERSON-006',
      'SYN-PERSON-007',
      'SYN-PERSON-008',
    ];

    const now = new Date();
    const daysAgo = (n: number) => {
      const d = new Date(now);
      d.setDate(d.getDate() - n);
      return d;
    };

    const events: NewPartnerServiceEvent[] = [
      // SYN-PERSON-001: cross-org pattern (3 orgs in 7 days) — the demo's hero case
      {
        person: 'SYN-PERSON-001',
        org: 'catholic-charities-owensboro',
        type: 'food_pantry',
        day: 0,
        notes: 'food box pickup',
      },
      {
        person: 'SYN-PERSON-001',
        org: 'audubon-area-community-services',
        type: 'utility_assistance',
        day: 3,
        notes: 'KU bill assistance request',
      },
      {
        person: 'SYN-PERSON-001',
        org: 'boulware-mission',
        type: 'shelter_intake',
        day: 6,
        notes: 'walk-in intake, bed assigned',
      },
      // SYN-PERSON-002: cross-org pattern (4 events at 2 orgs)
      {
        person: 'SYN-PERSON-002',
        org: 'st-benedicts-shelter',
        type: 'shelter_bed_night',
        day: 1,
        notes: null,
      },
      {
        person: 'SYN-PERSON-002',
        org: 'st-benedicts-shelter',
        type: 'shelter_bed_night',
        day: 2,
        notes: null,
      },
      {
        person: 'SYN-PERSON-002',
        org: 'catholic-charities-owensboro',
        type: 'food_pantry',
        day: 4,
        notes: null,
      },
      {
        person: 'SYN-PERSON-002',
        org: 'st-benedicts-shelter',
        type: 'shelter_bed_night',
        day: 5,
        notes: null,
      },
      // SYN-PERSON-003: families-with-children pattern
      {
        person: 'SYN-PERSON-003',
        org: 'daniel-pitino-shelter',
        type: 'shelter_intake',
        day: 10,
        notes: 'mother + 2 children',
      },
      {
        person: 'SYN-PERSON-003',
        org: 'crossroads-to-hope',
        type: 'counseling_visit',
        day: 12,
        notes: 'child welfare referral',
      },
      {
        person: 'SYN-PERSON-003',
        org: 'audubon-area-community-services',
        type: 'rent_assistance',
        day: 15,
        notes: 'security deposit help',
      },
      // SYN-PERSON-004 through 008: single-org touchpoints (typical population)
      {
        person: 'SYN-PERSON-004',
        org: 'boulware-mission',
        type: 'shelter_bed_night',
        day: 2,
        notes: null,
      },
      {
        person: 'SYN-PERSON-005',
        org: 'catholic-charities-owensboro',
        type: 'food_pantry',
        day: 5,
        notes: null,
      },
      {
        person: 'SYN-PERSON-006',
        org: 'audubon-area-community-services',
        type: 'utility_assistance',
        day: 8,
        notes: null,
      },
      {
        person: 'SYN-PERSON-007',
        org: 'crossroads-to-hope',
        type: 'shelter_intake',
        day: 1,
        notes: 'overnight, single night stay',
      },
      {
        person: 'SYN-PERSON-008',
        org: 'st-benedicts-shelter',
        type: 'shelter_bed_night',
        day: 0,
        notes: null,
      },
      // Extra cross-org touches to make the recent-week view interesting
      {
        person: 'SYN-PERSON-001',
        org: 'boulware-mission',
        type: 'counseling_visit',
        day: 7,
        notes: 'case-management intake',
      },
      {
        person: 'SYN-PERSON-002',
        org: 'st-benedicts-shelter',
        type: 'shelter_bed_night',
        day: 6,
        notes: null,
      },
    ].map((e) => ({
      partnerOrgId: orgIdBySlug.get(e.org)!,
      syntheticPersonRef: e.person,
      eventType: e.type as NewPartnerServiceEvent['eventType'],
      eventAt: daysAgo(e.day),
      notes: e.notes,
      source: 'synthetic' as const,
    }));

    await db.insert(partnerServiceEvents).values(events);
    console.log(
      `[seed]   + ${events.length} partner service events (${persons.length} synthetic persons)`,
    );
  } else {
    console.log('[seed]   = partner service events (exist)');
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
