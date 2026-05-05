#!/usr/bin/env tsx
/**
 * SUBP-005 — synthetic pre-release subjects seed.
 *
 * Idempotent. Re-running:
 *   - Creates the KY DOC partner_org if missing.
 *   - Creates an active KY DOC DSA (partner_agreement, kind=dsa,
 *     agency=ky_doc, individual_records_authorized=true,
 *     no_recidivism_prediction_attestation=true, pre_release_window_days=60)
 *     if missing.
 *   - Creates ~25 synthetic pre-release subjects distributed across the
 *     window: post-release-no-handoff, post-release-handed-off, critical
 *     (≤7 days), urgent (≤14), soon (≤30), planning (≤60), watch (>60 —
 *     but those are out of window so they should be filtered).
 *
 * All names are clearly synthetic. KY DOC inmate IDs are deterministic.
 *
 * Usage:
 *   pnpm tsx scripts/gen-synthetic-pre-release.ts
 *   pnpm tsx scripts/gen-synthetic-pre-release.ts --reset
 *
 * --reset deletes any existing synthetic pre-release subjects before
 * re-seeding (use only on dev / staging — never production).
 */

import { parseArgs } from 'node:util';
import { config as loadEnv } from 'dotenv';
import { and, eq, like, sql } from 'drizzle-orm';
import { db } from '@/db/client';
import { recordAgreement } from '@/db/queries/partner-agreements';
import { recordPreReleaseSubject } from '@/db/queries/pre-release-subjects';
import { partnerAgreements } from '@/db/schema/partner-agreements';
import { partnerOrgs } from '@/db/schema/partner-orgs';
import { preReleaseSubjects } from '@/db/schema/pre-release-subjects';
import { users } from '@/db/schema/users';
import type { KyDocDsaTerms } from '@/lib/dtrs';

loadEnv({ path: ['.env.local', '.env'], override: true });

const { values } = parseArgs({
  options: {
    reset: { type: 'boolean', default: false },
  },
});

const KY_DOC_SLUG = 'ky-doc-reentry-services';
const SYNTH_WINDOW_DAYS = 60; // matches DSA's pre_release_window_days

interface SyntheticSubject {
  firstName: string;
  lastName: string;
  daysToRelease: number; // positive = future; negative = past release
  releaseType: 'sentence_expiration' | 'parole' | 'transfer' | 'other';
  destination: string;
  handedOff: boolean;
  housingIntent: 'unknown' | 'none' | 'in_progress' | 'documented' | 'confirmed';
  employmentPlan: 'unknown' | 'none' | 'searching' | 'committed';
  medicaidStatus: 'unknown' | 'suspended' | 'resumption_filed' | 'resumed';
  treatment: 'unknown' | 'not_applicable' | 'none' | 'planned' | 'in_place';
  family: 'unknown' | 'none' | 'in_progress' | 'documented';
}

// Deterministic synthetic cohort — 25 subjects spread across the window.
// Naming convention: clearly fake first names, "Synthetic" last name.
const SYNTHETIC_SUBJECTS: SyntheticSubject[] = [
  // Recently released, handed off (kept under retention policy).
  {
    firstName: 'Adrian',
    lastName: 'Synthetic',
    daysToRelease: -3,
    releaseType: 'sentence_expiration',
    destination: 'Owensboro, KY',
    handedOff: true,
    housingIntent: 'confirmed',
    employmentPlan: 'committed',
    medicaidStatus: 'resumed',
    treatment: 'in_place',
    family: 'documented',
  },
  // Just released, not yet handed off (in 7-day grace tail).
  {
    firstName: 'Bailey',
    lastName: 'Synthetic',
    daysToRelease: -1,
    releaseType: 'parole',
    destination: 'Owensboro, KY',
    handedOff: false,
    housingIntent: 'documented',
    employmentPlan: 'searching',
    medicaidStatus: 'resumption_filed',
    treatment: 'planned',
    family: 'in_progress',
  },
  // Critical (0-7 days)
  {
    firstName: 'Cameron',
    lastName: 'Synthetic',
    daysToRelease: 2,
    releaseType: 'sentence_expiration',
    destination: 'Owensboro, KY',
    handedOff: false,
    housingIntent: 'confirmed',
    employmentPlan: 'searching',
    medicaidStatus: 'resumption_filed',
    treatment: 'planned',
    family: 'documented',
  },
  {
    firstName: 'Dakota',
    lastName: 'Synthetic',
    daysToRelease: 5,
    releaseType: 'parole',
    destination: 'Owensboro, KY',
    handedOff: false,
    housingIntent: 'documented',
    employmentPlan: 'committed',
    medicaidStatus: 'resumption_filed',
    treatment: 'in_place',
    family: 'in_progress',
  },
  {
    firstName: 'Emerson',
    lastName: 'Synthetic',
    daysToRelease: 7,
    releaseType: 'sentence_expiration',
    destination: 'Whitesville, KY',
    handedOff: false,
    housingIntent: 'in_progress',
    employmentPlan: 'searching',
    medicaidStatus: 'suspended',
    treatment: 'planned',
    family: 'in_progress',
  },
  // Urgent (8-14 days)
  {
    firstName: 'Frankie',
    lastName: 'Synthetic',
    daysToRelease: 9,
    releaseType: 'sentence_expiration',
    destination: 'Owensboro, KY',
    handedOff: false,
    housingIntent: 'in_progress',
    employmentPlan: 'searching',
    medicaidStatus: 'resumption_filed',
    treatment: 'planned',
    family: 'in_progress',
  },
  {
    firstName: 'Gray',
    lastName: 'Synthetic',
    daysToRelease: 11,
    releaseType: 'parole',
    destination: 'Philpot, KY',
    handedOff: false,
    housingIntent: 'documented',
    employmentPlan: 'committed',
    medicaidStatus: 'resumption_filed',
    treatment: 'in_place',
    family: 'in_progress',
  },
  {
    firstName: 'Harley',
    lastName: 'Synthetic',
    daysToRelease: 13,
    releaseType: 'sentence_expiration',
    destination: 'Owensboro, KY',
    handedOff: false,
    housingIntent: 'in_progress',
    employmentPlan: 'searching',
    medicaidStatus: 'suspended',
    treatment: 'not_applicable',
    family: 'unknown',
  },
  // Soon (15-30 days)
  {
    firstName: 'Indigo',
    lastName: 'Synthetic',
    daysToRelease: 17,
    releaseType: 'sentence_expiration',
    destination: 'Owensboro, KY',
    handedOff: false,
    housingIntent: 'in_progress',
    employmentPlan: 'searching',
    medicaidStatus: 'suspended',
    treatment: 'planned',
    family: 'in_progress',
  },
  {
    firstName: 'Jules',
    lastName: 'Synthetic',
    daysToRelease: 21,
    releaseType: 'parole',
    destination: 'Owensboro, KY',
    handedOff: false,
    housingIntent: 'in_progress',
    employmentPlan: 'searching',
    medicaidStatus: 'suspended',
    treatment: 'planned',
    family: 'in_progress',
  },
  {
    firstName: 'Kerry',
    lastName: 'Synthetic',
    daysToRelease: 24,
    releaseType: 'sentence_expiration',
    destination: 'Maceo, KY',
    handedOff: false,
    housingIntent: 'none',
    employmentPlan: 'none',
    medicaidStatus: 'suspended',
    treatment: 'unknown',
    family: 'unknown',
  },
  {
    firstName: 'Logan',
    lastName: 'Synthetic',
    daysToRelease: 28,
    releaseType: 'sentence_expiration',
    destination: 'Owensboro, KY',
    handedOff: false,
    housingIntent: 'in_progress',
    employmentPlan: 'searching',
    medicaidStatus: 'suspended',
    treatment: 'in_place',
    family: 'in_progress',
  },
  {
    firstName: 'Morgan',
    lastName: 'Synthetic',
    daysToRelease: 30,
    releaseType: 'parole',
    destination: 'Owensboro, KY',
    handedOff: false,
    housingIntent: 'unknown',
    employmentPlan: 'unknown',
    medicaidStatus: 'unknown',
    treatment: 'unknown',
    family: 'unknown',
  },
  // Planning (31-60 days)
  {
    firstName: 'Nico',
    lastName: 'Synthetic',
    daysToRelease: 35,
    releaseType: 'sentence_expiration',
    destination: 'Owensboro, KY',
    handedOff: false,
    housingIntent: 'in_progress',
    employmentPlan: 'searching',
    medicaidStatus: 'suspended',
    treatment: 'planned',
    family: 'in_progress',
  },
  {
    firstName: 'Onyx',
    lastName: 'Synthetic',
    daysToRelease: 42,
    releaseType: 'sentence_expiration',
    destination: 'Whitesville, KY',
    handedOff: false,
    housingIntent: 'unknown',
    employmentPlan: 'none',
    medicaidStatus: 'suspended',
    treatment: 'unknown',
    family: 'none',
  },
  {
    firstName: 'Parker',
    lastName: 'Synthetic',
    daysToRelease: 49,
    releaseType: 'parole',
    destination: 'Owensboro, KY',
    handedOff: false,
    housingIntent: 'in_progress',
    employmentPlan: 'searching',
    medicaidStatus: 'suspended',
    treatment: 'planned',
    family: 'in_progress',
  },
  {
    firstName: 'Quinn',
    lastName: 'Synthetic',
    daysToRelease: 56,
    releaseType: 'sentence_expiration',
    destination: 'Owensboro, KY',
    handedOff: false,
    housingIntent: 'unknown',
    employmentPlan: 'unknown',
    medicaidStatus: 'suspended',
    treatment: 'unknown',
    family: 'unknown',
  },
  {
    firstName: 'River',
    lastName: 'Synthetic',
    daysToRelease: 60,
    releaseType: 'sentence_expiration',
    destination: 'Owensboro, KY',
    handedOff: false,
    housingIntent: 'none',
    employmentPlan: 'none',
    medicaidStatus: 'suspended',
    treatment: 'unknown',
    family: 'unknown',
  },
];

function dateFromDaysOut(daysOut: number, asOf: Date): string {
  const d = new Date(Date.UTC(asOf.getUTCFullYear(), asOf.getUTCMonth(), asOf.getUTCDate()));
  d.setUTCDate(d.getUTCDate() + daysOut);
  return d.toISOString().slice(0, 10);
}

function dobFromBirthYear(year: number): string {
  // Deterministic DOB on May 1 of the chosen year.
  return `${year}-05-01`;
}

async function ensureKyDocPartnerOrg(): Promise<string> {
  const [existing] = await db
    .select({ id: partnerOrgs.id })
    .from(partnerOrgs)
    .where(eq(partnerOrgs.slug, KY_DOC_SLUG))
    .limit(1);
  if (existing) return existing.id;

  const [created] = await db
    .insert(partnerOrgs)
    .values({
      name: 'Kentucky Department of Corrections — Reentry Services',
      slug: KY_DOC_SLUG,
      type: 'government',
      contactEmail: 'reentry@ky.gov.example',
      website: 'https://corrections.ky.gov/reentry',
    })
    .returning({ id: partnerOrgs.id });
  if (!created) throw new Error('failed to create KY DOC partner_org');
  return created.id;
}

async function ensureSystemUser(): Promise<string> {
  const [existing] = await db
    .select({ id: users.id })
    .from(users)
    .where(eq(users.email, 'system+seed-kydoc@dchc.example'))
    .limit(1);
  if (existing) return existing.id;
  const [created] = await db
    .insert(users)
    .values({
      email: 'system+seed-kydoc@dchc.example',
      clerkUserId: 'seed_system_kydoc',
      role: 'admin',
      firstName: 'System',
      lastName: 'Seed',
    })
    .returning({ id: users.id });
  if (!created) throw new Error('failed to create system seed user');
  return created.id;
}

async function ensureActiveKyDocDsa(
  kyDocPartnerOrgId: string,
  systemUserId: string,
): Promise<string> {
  // Use raw JSONB filter to find the KY DOC DSA specifically (not DCBS / OASIS).
  const [existing] = await db
    .select({ id: partnerAgreements.id })
    .from(partnerAgreements)
    .where(
      and(
        eq(partnerAgreements.partnerOrgId, kyDocPartnerOrgId),
        eq(partnerAgreements.kind, 'dsa'),
        eq(partnerAgreements.status, 'active'),
        sql`(${partnerAgreements.terms}->>'agency') = 'ky_doc'`,
      ),
    )
    .limit(1);
  if (existing) return existing.id;

  const terms: KyDocDsaTerms = {
    kind: 'dsa',
    agency: 'ky_doc',
    scope: [
      'pre_release_roster',
      'release_date_changes',
      'supports_in_place',
      'reentry_eligibility',
    ],
    agency_legal_name: 'Kentucky Department of Corrections',
    state_contact: {
      name: 'Synthetic Contact',
      title: 'Reentry Services Branch Manager',
      email: 'reentry@ky.gov.example',
    },
    population_focus: 'pre_release',
    pre_release_window_days: SYNTH_WINDOW_DAYS,
    individual_records_authorized: true,
    no_recidivism_prediction_attestation: true,
    data_destruction_due: 'on_termination',
  };

  const created = await recordAgreement({
    partnerOrgId: kyDocPartnerOrgId,
    kind: 'dsa',
    status: 'active',
    effectiveDate: new Date().toISOString().slice(0, 10),
    endDate: null,
    signedByPartner: 'Synthetic Signer, KY DOC',
    signedByCoalitionUserId: systemUserId,
    templateVersion: 'kydoc-dsa-v1',
    templateRendered: null,
    terms,
    notes: 'Seeded by gen-synthetic-pre-release.ts',
    actorUserId: systemUserId,
  });
  return created.id;
}

async function maybeReset(kyDocPartnerOrgId: string) {
  if (!values.reset) return;
  const synthetic = await db
    .select({ id: preReleaseSubjects.id })
    .from(preReleaseSubjects)
    .where(
      and(
        eq(preReleaseSubjects.kyDocPartnerOrgId, kyDocPartnerOrgId),
        like(preReleaseSubjects.legalLastName, 'Synthetic'),
      ),
    );
  if (synthetic.length === 0) return;
  console.log(`Resetting ${synthetic.length} synthetic pre-release subjects…`);
  for (const { id } of synthetic) {
    await db.delete(preReleaseSubjects).where(eq(preReleaseSubjects.id, id));
  }
}

async function main() {
  console.log('SUBP-005 synthetic seed starting…');

  const kyDocPartnerOrgId = await ensureKyDocPartnerOrg();
  console.log(`  KY DOC partner_org: ${kyDocPartnerOrgId}`);

  const systemUserId = await ensureSystemUser();
  console.log(`  system seed user: ${systemUserId}`);

  const dsaId = await ensureActiveKyDocDsa(kyDocPartnerOrgId, systemUserId);
  console.log(`  active KY DOC DSA: ${dsaId}`);

  await maybeReset(kyDocPartnerOrgId);

  const asOf = new Date();
  let inserted = 0;
  let skipped = 0;

  for (const [i, s] of SYNTHETIC_SUBJECTS.entries()) {
    const projectedReleaseDate = dateFromDaysOut(s.daysToRelease, asOf);
    // DOB deterministic from index — varies the cohort age 22..50.
    const dob = dobFromBirthYear(asOf.getUTCFullYear() - (22 + (i % 28)));
    const inmateId = `SYNTH-KYDOC-${String(i + 1).padStart(3, '0')}`;

    // Idempotency: skip if a subject with this inmate_id already exists.
    const [existing] = await db
      .select({ id: preReleaseSubjects.id })
      .from(preReleaseSubjects)
      .where(eq(preReleaseSubjects.kyDocInmateId, inmateId))
      .limit(1);
    if (existing) {
      skipped += 1;
      continue;
    }

    const row = await recordPreReleaseSubject({
      kyDocPartnerOrgId,
      kyDocInmateId: inmateId,
      legalFirstName: s.firstName,
      legalLastName: s.lastName,
      dateOfBirth: dob,
      projectedReleaseDate,
      releaseType: s.releaseType,
      designatedDestination: s.destination,
      assignedCaseworkerUserId: null,
      supportsInPlace: {
        housing_intent: s.housingIntent,
        employment_plan: s.employmentPlan,
        medicaid_status: s.medicaidStatus,
        treatment_continuity: s.treatment,
        family_connection: s.family,
      },
      status: s.handedOff ? 'handed_off' : 'active',
      handedOffAt: s.handedOff ? new Date() : null,
      notes: null,
      actorUserId: systemUserId,
    });
    inserted += 1;
    void row;
  }

  console.log(`Done. inserted=${inserted}, skipped=${skipped} (idempotent re-run).`);
  process.exit(0);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
