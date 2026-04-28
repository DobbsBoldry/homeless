#!/usr/bin/env tsx
/**
 * SUBP-007 — synthetic families w/ children seed.
 *
 * Idempotent. Re-running:
 *   - Creates ~12 synthetic families across the housing-status × entry-
 *     signal × school-stability matrix.
 *   - Each family gets 1–3 children with grade-band variety.
 *   - Some families are linked to existing synthetic school-referral
 *     rows (for the cross-link surface); others originate from
 *     eviction or ED signals (soft entrySignalId references).
 *
 * Synthetic-only — names follow the cwt/esuc/subp pattern of obviously
 * synthetic surnames.
 *
 * Usage:
 *   pnpm tsx scripts/gen-synthetic-families.ts
 *   pnpm tsx scripts/gen-synthetic-families.ts --reset
 */

import { parseArgs } from 'node:util';
import { config as loadEnv } from 'dotenv';
import { eq, like } from 'drizzle-orm';
import { db } from '@/db/client';
import type {
  FamilyChildGradeBand,
  FamilyEntrySignal,
  FamilyHousingStatus,
} from '@/db/schema/enums';
import { familyChildren, familyUnits } from '@/db/schema/family-units';
import { partnerOrgs } from '@/db/schema/partner-orgs';
import { users } from '@/db/schema/users';

loadEnv({ path: ['.env.local', '.env'], override: true });

const { values } = parseArgs({
  options: {
    reset: { type: 'boolean', default: false },
  },
});

interface SyntheticChild {
  childRef: string;
  gradeBand: FamilyChildGradeBand;
  mckinneyVento: boolean;
  schoolOfOrigin: boolean; // true = currentSchool == receivingSchool; false = changed
}

interface SyntheticFamily {
  primaryCaregiverName: string;
  householdSize: number;
  childrenCount: number;
  entrySignal: FamilyEntrySignal;
  housingStatus: FamilyHousingStatus;
  children: SyntheticChild[];
}

const SYNTHETIC_FAMILIES: SyntheticFamily[] = [
  {
    primaryCaregiverName: 'Aja Synthetic',
    householdSize: 4,
    childrenCount: 2,
    entrySignal: 'school_referral',
    housingStatus: 'doubled_up',
    children: [
      { childRef: 'AJA-C1', gradeBand: 'elementary', mckinneyVento: true, schoolOfOrigin: true },
      { childRef: 'AJA-C2', gradeBand: 'middle', mckinneyVento: true, schoolOfOrigin: true },
    ],
  },
  {
    primaryCaregiverName: 'Bryn Synthetic',
    householdSize: 3,
    childrenCount: 1,
    entrySignal: 'eviction',
    housingStatus: 'shelter',
    children: [
      { childRef: 'BRY-C1', gradeBand: 'high', mckinneyVento: true, schoolOfOrigin: false },
    ],
  },
  {
    primaryCaregiverName: 'Cory Synthetic',
    householdSize: 5,
    childrenCount: 3,
    entrySignal: 'sms_intake',
    housingStatus: 'unsheltered',
    children: [
      { childRef: 'COR-C1', gradeBand: 'elementary', mckinneyVento: false, schoolOfOrigin: false },
      { childRef: 'COR-C2', gradeBand: 'elementary', mckinneyVento: false, schoolOfOrigin: false },
      { childRef: 'COR-C3', gradeBand: 'pre_k', mckinneyVento: false, schoolOfOrigin: true },
    ],
  },
  {
    primaryCaregiverName: 'Devi Synthetic',
    householdSize: 2,
    childrenCount: 1,
    entrySignal: 'school_referral',
    housingStatus: 'hotel',
    children: [
      { childRef: 'DEV-C1', gradeBand: 'middle', mckinneyVento: true, schoolOfOrigin: true },
    ],
  },
  {
    primaryCaregiverName: 'Emi Synthetic',
    householdSize: 3,
    childrenCount: 2,
    entrySignal: 'eviction',
    housingStatus: 'doubled_up',
    children: [
      { childRef: 'EMI-C1', gradeBand: 'elementary', mckinneyVento: false, schoolOfOrigin: false },
      { childRef: 'EMI-C2', gradeBand: 'middle', mckinneyVento: false, schoolOfOrigin: false },
    ],
  },
  {
    primaryCaregiverName: 'Finn Synthetic',
    householdSize: 4,
    childrenCount: 2,
    entrySignal: 'ed_encounter',
    housingStatus: 'shelter',
    children: [
      { childRef: 'FIN-C1', gradeBand: 'high', mckinneyVento: true, schoolOfOrigin: true },
      { childRef: 'FIN-C2', gradeBand: 'elementary', mckinneyVento: true, schoolOfOrigin: true },
    ],
  },
  {
    primaryCaregiverName: 'Gem Synthetic',
    householdSize: 2,
    childrenCount: 1,
    entrySignal: 'walk_in',
    housingStatus: 'stably_housed',
    children: [
      { childRef: 'GEM-C1', gradeBand: 'high', mckinneyVento: false, schoolOfOrigin: true },
    ],
  },
  {
    primaryCaregiverName: 'Hari Synthetic',
    householdSize: 4,
    childrenCount: 2,
    entrySignal: 'school_referral',
    housingStatus: 'doubled_up',
    children: [
      { childRef: 'HAR-C1', gradeBand: 'middle', mckinneyVento: true, schoolOfOrigin: false },
      { childRef: 'HAR-C2', gradeBand: 'middle', mckinneyVento: true, schoolOfOrigin: false },
    ],
  },
  {
    primaryCaregiverName: 'Iris Synthetic',
    householdSize: 5,
    childrenCount: 3,
    entrySignal: 'sms_intake',
    housingStatus: 'doubled_up',
    children: [
      { childRef: 'IRI-C1', gradeBand: 'elementary', mckinneyVento: false, schoolOfOrigin: true },
      { childRef: 'IRI-C2', gradeBand: 'pre_k', mckinneyVento: false, schoolOfOrigin: true },
      { childRef: 'IRI-C3', gradeBand: 'pre_k', mckinneyVento: false, schoolOfOrigin: true },
    ],
  },
  {
    primaryCaregiverName: 'Juno Synthetic',
    householdSize: 3,
    childrenCount: 2,
    entrySignal: 'eviction',
    housingStatus: 'unsheltered',
    children: [
      { childRef: 'JUN-C1', gradeBand: 'middle', mckinneyVento: true, schoolOfOrigin: false },
      { childRef: 'JUN-C2', gradeBand: 'high', mckinneyVento: true, schoolOfOrigin: false },
    ],
  },
  {
    primaryCaregiverName: 'Kai Synthetic',
    householdSize: 2,
    childrenCount: 1,
    entrySignal: 'school_referral',
    housingStatus: 'stably_housed',
    children: [
      { childRef: 'KAI-C1', gradeBand: 'elementary', mckinneyVento: false, schoolOfOrigin: true },
    ],
  },
  {
    primaryCaregiverName: 'Lex Synthetic',
    householdSize: 4,
    childrenCount: 2,
    entrySignal: 'ed_encounter',
    housingStatus: 'hotel',
    children: [
      { childRef: 'LEX-C1', gradeBand: 'high', mckinneyVento: true, schoolOfOrigin: true },
      {
        childRef: 'LEX-C2',
        gradeBand: 'not_enrolled',
        mckinneyVento: false,
        schoolOfOrigin: true,
      },
    ],
  },
];

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
      clerkUserId: 'seed_system_families',
      role: 'admin',
      firstName: 'System',
      lastName: 'Seed',
    })
    .returning({ id: users.id });
  if (!created) throw new Error('failed to create system seed user');
  return created.id;
}

async function pickSchool(): Promise<string | null> {
  const [school] = await db
    .select({ id: partnerOrgs.id })
    .from(partnerOrgs)
    .where(eq(partnerOrgs.type, 'school'))
    .limit(1);
  return school?.id ?? null;
}

async function pickAlternateSchool(currentId: string | null): Promise<string | null> {
  if (!currentId) return null;
  const all = await db
    .select({ id: partnerOrgs.id })
    .from(partnerOrgs)
    .where(eq(partnerOrgs.type, 'school'));
  const other = all.find((s) => s.id !== currentId);
  return other?.id ?? null;
}

async function maybeReset(): Promise<void> {
  if (!values.reset) return;
  const synthetic = await db
    .select({ id: familyUnits.id })
    .from(familyUnits)
    .where(like(familyUnits.primaryCaregiverName, '% Synthetic'));
  if (synthetic.length === 0) return;
  console.log(`Resetting ${synthetic.length} synthetic families (children cascade)…`);
  for (const { id } of synthetic) {
    await db.delete(familyChildren).where(eq(familyChildren.familyUnitId, id));
    await db.delete(familyUnits).where(eq(familyUnits.id, id));
  }
}

async function main() {
  console.log('SUBP-007 synthetic seed starting…');

  const systemUserId = await ensureSystemUser();
  console.log(`  system seed user: ${systemUserId}`);

  await maybeReset();

  const receivingSchoolId = await pickSchool();
  const alternateSchoolId = await pickAlternateSchool(receivingSchoolId);
  console.log(
    `  schools: receiving=${receivingSchoolId ?? '<none>'} alternate=${alternateSchoolId ?? '<none>'}`,
  );

  let inserted = 0;
  let skipped = 0;

  for (const f of SYNTHETIC_FAMILIES) {
    const [existing] = await db
      .select({ id: familyUnits.id })
      .from(familyUnits)
      .where(eq(familyUnits.primaryCaregiverName, f.primaryCaregiverName))
      .limit(1);
    if (existing) {
      skipped += 1;
      continue;
    }

    const [created] = await db
      .insert(familyUnits)
      .values({
        primaryCaregiverName: f.primaryCaregiverName,
        householdSize: f.householdSize,
        childrenCount: f.childrenCount,
        status: 'active',
        entrySignal: f.entrySignal,
        // entrySignalId is a soft FK; for synthetic data we leave it
        // null. Real ingest paths set it from the source row.
        entrySignalId: null,
        currentHousingStatus: f.housingStatus,
        assignedCaseworkerUserId: null,
        receivingSchoolDistrictId: receivingSchoolId,
      })
      .returning({ id: familyUnits.id });
    if (!created) throw new Error(`insert failed for ${f.primaryCaregiverName}`);

    for (const c of f.children) {
      const currentSchoolId = c.schoolOfOrigin ? receivingSchoolId : alternateSchoolId;
      await db.insert(familyChildren).values({
        familyUnitId: created.id,
        childRef: c.childRef,
        currentSchoolId,
        gradeBand: c.gradeBand,
        enrolledInMckinneyVento: {
          flagged: c.mckinneyVento,
          flaggedAt: c.mckinneyVento ? new Date().toISOString() : null,
          source: c.mckinneyVento ? 'synthetic_seed' : null,
        },
      });
    }
    inserted += 1;
  }

  console.log(`Done. inserted=${inserted}, skipped=${skipped}.`);
  process.exit(0);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
