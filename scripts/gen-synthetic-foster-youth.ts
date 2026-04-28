#!/usr/bin/env tsx
/**
 * SUBP-001 — synthetic foster-youth seed.
 *
 * Idempotent. Re-running:
 *   - Creates the DCBS Region 2 (Owensboro) partner_org if missing.
 *   - Creates an active DCBS DSA (partner_agreement, kind=dsa, agency=dcbs,
 *     individual_records_authorized=true) if missing.
 *   - Creates ~30 synthetic foster youth distributed across the
 *     milestone bands (90+, 90, 60, 30, 14, 7, aged-out).
 *
 * All names are clearly synthetic. DOBs are deterministic from a fixed seed.
 *
 * Usage:
 *   pnpm tsx scripts/gen-synthetic-foster-youth.ts
 *   pnpm tsx scripts/gen-synthetic-foster-youth.ts --reset
 *
 * --reset deletes any existing synthetic foster_youth + alerts before
 * re-seeding (use only on dev / staging — never production).
 */

import { parseArgs } from 'node:util';
import { config as loadEnv } from 'dotenv';
import { and, eq, like } from 'drizzle-orm';
import { db } from '@/db/client';
import { recordFosterYouth } from '@/db/queries/foster-youth';
import { recordAgreement } from '@/db/queries/partner-agreements';
import { fosterAgingOutAlerts } from '@/db/schema/foster-aging-out-alerts';
import { fosterYouth } from '@/db/schema/foster-youth';
import { partnerAgreements } from '@/db/schema/partner-agreements';
import { partnerOrgs } from '@/db/schema/partner-orgs';
import { users } from '@/db/schema/users';
import type { DcbsDsaTerms } from '@/lib/dtrs';

loadEnv({ path: ['.env.local', '.env'], override: true });

const { values } = parseArgs({
  options: {
    reset: { type: 'boolean', default: false },
  },
});

const DCBS_SLUG = 'dcbs-region-2-owensboro';

interface SyntheticYouth {
  firstName: string;
  lastName: string;
  daysFromEighteen: number; // computed → DOB
  placement: 'family_foster' | 'kinship' | 'group_home' | 'residential' | 'independent_living';
  placementChanges: number;
}

const SYNTHETIC_YOUTH: SyntheticYouth[] = [
  // Already aged out (recent — appears in alerts but not active list)
  {
    firstName: 'Aaron',
    lastName: 'Synthetic',
    daysFromEighteen: -3,
    placement: 'family_foster',
    placementChanges: 4,
  },
  {
    firstName: 'Bria',
    lastName: 'Synthetic',
    daysFromEighteen: -10,
    placement: 'group_home',
    placementChanges: 7,
  },
  // Critical (d <= 14)
  {
    firstName: 'Cassidy',
    lastName: 'Synthetic',
    daysFromEighteen: 5,
    placement: 'kinship',
    placementChanges: 2,
  },
  {
    firstName: 'Devyn',
    lastName: 'Synthetic',
    daysFromEighteen: 8,
    placement: 'group_home',
    placementChanges: 5,
  },
  {
    firstName: 'Elliot',
    lastName: 'Synthetic',
    daysFromEighteen: 11,
    placement: 'family_foster',
    placementChanges: 3,
  },
  {
    firstName: 'Frankie',
    lastName: 'Synthetic',
    daysFromEighteen: 14,
    placement: 'residential',
    placementChanges: 6,
  },
  // Urgent (d 15-30)
  {
    firstName: 'Greer',
    lastName: 'Synthetic',
    daysFromEighteen: 18,
    placement: 'kinship',
    placementChanges: 2,
  },
  {
    firstName: 'Harper',
    lastName: 'Synthetic',
    daysFromEighteen: 22,
    placement: 'family_foster',
    placementChanges: 4,
  },
  {
    firstName: 'Indie',
    lastName: 'Synthetic',
    daysFromEighteen: 27,
    placement: 'independent_living',
    placementChanges: 3,
  },
  {
    firstName: 'Jules',
    lastName: 'Synthetic',
    daysFromEighteen: 30,
    placement: 'group_home',
    placementChanges: 5,
  },
  // Soon (d 31-60)
  {
    firstName: 'Kai',
    lastName: 'Synthetic',
    daysFromEighteen: 35,
    placement: 'family_foster',
    placementChanges: 2,
  },
  {
    firstName: 'Lennox',
    lastName: 'Synthetic',
    daysFromEighteen: 42,
    placement: 'kinship',
    placementChanges: 1,
  },
  {
    firstName: 'Marley',
    lastName: 'Synthetic',
    daysFromEighteen: 50,
    placement: 'group_home',
    placementChanges: 4,
  },
  {
    firstName: 'Noor',
    lastName: 'Synthetic',
    daysFromEighteen: 58,
    placement: 'family_foster',
    placementChanges: 3,
  },
  // Watch (d 61-90)
  {
    firstName: 'Onyx',
    lastName: 'Synthetic',
    daysFromEighteen: 65,
    placement: 'residential',
    placementChanges: 5,
  },
  {
    firstName: 'Phoenix',
    lastName: 'Synthetic',
    daysFromEighteen: 75,
    placement: 'kinship',
    placementChanges: 2,
  },
  {
    firstName: 'Quinn',
    lastName: 'Synthetic',
    daysFromEighteen: 85,
    placement: 'family_foster',
    placementChanges: 1,
  },
  {
    firstName: 'Riley',
    lastName: 'Synthetic',
    daysFromEighteen: 90,
    placement: 'group_home',
    placementChanges: 4,
  },
  // Safe (d > 90) — outside any milestone band; in active list but no alerts
  {
    firstName: 'Sage',
    lastName: 'Synthetic',
    daysFromEighteen: 100,
    placement: 'family_foster',
    placementChanges: 2,
  },
  {
    firstName: 'Tatum',
    lastName: 'Synthetic',
    daysFromEighteen: 130,
    placement: 'kinship',
    placementChanges: 1,
  },
  {
    firstName: 'Uriah',
    lastName: 'Synthetic',
    daysFromEighteen: 165,
    placement: 'family_foster',
    placementChanges: 3,
  },
  {
    firstName: 'Valen',
    lastName: 'Synthetic',
    daysFromEighteen: 200,
    placement: 'group_home',
    placementChanges: 4,
  },
  {
    firstName: 'West',
    lastName: 'Synthetic',
    daysFromEighteen: 250,
    placement: 'residential',
    placementChanges: 6,
  },
  {
    firstName: 'Xan',
    lastName: 'Synthetic',
    daysFromEighteen: 320,
    placement: 'kinship',
    placementChanges: 2,
  },
  {
    firstName: 'Yara',
    lastName: 'Synthetic',
    daysFromEighteen: 400,
    placement: 'family_foster',
    placementChanges: 1,
  },
  // Edge cases
  {
    firstName: 'Zora',
    lastName: 'Synthetic',
    daysFromEighteen: 0,
    placement: 'group_home',
    placementChanges: 5,
  }, // 18th birthday today
  {
    firstName: 'Avi',
    lastName: 'Synthetic',
    daysFromEighteen: 91,
    placement: 'family_foster',
    placementChanges: 2,
  }, // just outside d90
  {
    firstName: 'Briar',
    lastName: 'Synthetic',
    daysFromEighteen: 89,
    placement: 'kinship',
    placementChanges: 3,
  }, // just inside d90
  {
    firstName: 'Cypress',
    lastName: 'Synthetic',
    daysFromEighteen: 7,
    placement: 'family_foster',
    placementChanges: 4,
  }, // exactly d7
  {
    firstName: 'Dune',
    lastName: 'Synthetic',
    daysFromEighteen: 1,
    placement: 'independent_living',
    placementChanges: 8,
  }, // tomorrow
];

function dobFromDays(daysOut: number, asOf: Date): string {
  // 18th birthday is asOf + daysOut. DOB is 18 years before that.
  const eighteenth = new Date(
    Date.UTC(asOf.getUTCFullYear(), asOf.getUTCMonth(), asOf.getUTCDate()),
  );
  eighteenth.setUTCDate(eighteenth.getUTCDate() + daysOut);
  const dob = new Date(
    Date.UTC(eighteenth.getUTCFullYear() - 18, eighteenth.getUTCMonth(), eighteenth.getUTCDate()),
  );
  return dob.toISOString().slice(0, 10);
}

async function ensureDcbsPartnerOrg(): Promise<string> {
  const [existing] = await db
    .select({ id: partnerOrgs.id })
    .from(partnerOrgs)
    .where(eq(partnerOrgs.slug, DCBS_SLUG))
    .limit(1);
  if (existing) return existing.id;

  const [created] = await db
    .insert(partnerOrgs)
    .values({
      name: 'DCBS — Region 2 (Owensboro)',
      slug: DCBS_SLUG,
      type: 'government',
      contactEmail: 'r2-dcbs@ky.gov.example',
      website: 'https://chfs.ky.gov/agencies/dcbs',
    })
    .returning({ id: partnerOrgs.id });
  if (!created) throw new Error('failed to create DCBS partner_org');
  return created.id;
}

async function ensureSystemUser(): Promise<string> {
  const [existing] = await db
    .select({ id: users.id })
    .from(users)
    .where(eq(users.email, 'system+seed@dchc.example'))
    .limit(1);
  if (existing) return existing.id;
  const [created] = await db
    .insert(users)
    .values({
      email: 'system+seed@dchc.example',
      clerkUserId: 'seed_system_dcbs',
      role: 'admin',
      firstName: 'System',
      lastName: 'Seed',
    })
    .returning({ id: users.id });
  if (!created) throw new Error('failed to create system seed user');
  return created.id;
}

async function ensureActiveDcbsDsa(
  dcbsPartnerOrgId: string,
  systemUserId: string,
): Promise<string> {
  const [existing] = await db
    .select({ id: partnerAgreements.id })
    .from(partnerAgreements)
    .where(
      and(
        eq(partnerAgreements.partnerOrgId, dcbsPartnerOrgId),
        eq(partnerAgreements.kind, 'dsa'),
        eq(partnerAgreements.status, 'active'),
      ),
    )
    .limit(1);
  if (existing) return existing.id;

  const terms: DcbsDsaTerms = {
    kind: 'dsa',
    agency: 'dcbs',
    scope: [
      'foster_aging_out_roster',
      'placement_history',
      'supports_in_place',
      'teamky_eligibility',
    ],
    agency_legal_name:
      'Kentucky Cabinet for Health and Family Services, Department for Community Based Services',
    state_contact: {
      name: 'Synthetic Contact',
      title: 'Service Region Administrator',
      email: 'r2-dcbs@ky.gov.example',
    },
    population_focus: 'foster_aging_out',
    individual_records_authorized: true,
    data_destruction_due: 'on_termination',
  };

  const created = await recordAgreement({
    partnerOrgId: dcbsPartnerOrgId,
    kind: 'dsa',
    status: 'active',
    effectiveDate: new Date().toISOString().slice(0, 10),
    endDate: null,
    signedByPartner: 'Synthetic Signer, DCBS',
    signedByCoalitionUserId: systemUserId,
    templateVersion: 'dcbs-dsa-v1',
    templateRendered: null,
    terms,
    notes: 'Seeded by gen-synthetic-foster-youth.ts',
    actorUserId: systemUserId,
  });
  return created.id;
}

async function maybeReset(dcbsPartnerOrgId: string) {
  if (!values.reset) return;
  // Cascade: deleting foster_youth removes alerts via FK ON DELETE CASCADE.
  const synthetic = await db
    .select({ id: fosterYouth.id })
    .from(fosterYouth)
    .where(
      and(
        eq(fosterYouth.dcbsPartnerOrgId, dcbsPartnerOrgId),
        like(fosterYouth.legalLastName, 'Synthetic'),
      ),
    );
  if (synthetic.length === 0) return;
  console.log(`Resetting ${synthetic.length} synthetic youth (and their alerts via cascade)…`);
  for (const { id } of synthetic) {
    await db.delete(fosterAgingOutAlerts).where(eq(fosterAgingOutAlerts.youthId, id));
    await db.delete(fosterYouth).where(eq(fosterYouth.id, id));
  }
}

async function main() {
  console.log('SUBP-001 synthetic seed starting…');

  const dcbsPartnerOrgId = await ensureDcbsPartnerOrg();
  console.log(`  DCBS partner_org: ${dcbsPartnerOrgId}`);

  const systemUserId = await ensureSystemUser();
  console.log(`  system seed user: ${systemUserId}`);

  const dsaId = await ensureActiveDcbsDsa(dcbsPartnerOrgId, systemUserId);
  console.log(`  active DCBS DSA: ${dsaId}`);

  await maybeReset(dcbsPartnerOrgId);

  const asOf = new Date();
  let inserted = 0;
  let skipped = 0;

  for (const y of SYNTHETIC_YOUTH) {
    const dob = dobFromDays(y.daysFromEighteen, asOf);
    const caseId = `SYNTH-${y.firstName.toUpperCase()}-${y.daysFromEighteen}`;

    // Idempotency: skip if a youth with this case_id already exists.
    const [existing] = await db
      .select({ id: fosterYouth.id })
      .from(fosterYouth)
      .where(eq(fosterYouth.dcbsCaseId, caseId))
      .limit(1);
    if (existing) {
      skipped += 1;
      continue;
    }

    await recordFosterYouth({
      dcbsPartnerOrgId,
      dcbsCaseId: caseId,
      legalFirstName: y.firstName,
      legalLastName: y.lastName,
      dateOfBirth: dob,
      placementType: y.placement,
      placementChangesCount: y.placementChanges,
      assignedCaseworkerUserId: null,
      supportsInPlace: {
        housing_plan: y.daysFromEighteen <= 30 ? 'in_progress' : 'unknown',
        medicaid_extension: y.daysFromEighteen <= 14 ? 'drafted' : 'not_filed',
        education_plan: y.placement === 'independent_living' ? 'high_school' : 'unknown',
        employment_plan: y.daysFromEighteen <= 60 ? 'searching' : 'none',
      },
      status: y.daysFromEighteen <= 0 ? 'aged_out' : 'active',
      notes: null,
      actorUserId: systemUserId,
    });
    inserted += 1;
  }

  console.log(`Done. inserted=${inserted}, skipped=${skipped} (idempotent re-run).`);
  process.exit(0);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
