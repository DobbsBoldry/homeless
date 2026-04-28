#!/usr/bin/env tsx
/**
 * SUBP-004 — synthetic DV-survivor seed.
 *
 * Idempotent. Re-running:
 *   - Ensures the OASIS partner_org exists (slug=oasis-shelter from base seed).
 *   - Ensures an active OASIS DSA (partner_agreement, kind=dsa, agency=oasis,
 *     redaction_policy = abuser-blind defaults, attestation=true).
 *   - Creates ~25 synthetic survivors distributed across risk tiers and
 *     statuses, plus edge cases.
 *
 * Synthetic-only — no real survivor data may land here pre-DSA.
 *
 * Usage:
 *   pnpm tsx scripts/gen-synthetic-dv-survivors.ts
 *   pnpm tsx scripts/gen-synthetic-dv-survivors.ts --reset
 *
 * --reset deletes any existing synthetic dv_survivors before re-seeding
 * (use only on dev / staging — never production).
 */

import { parseArgs } from 'node:util';
import { config as loadEnv } from 'dotenv';
import { and, eq, like } from 'drizzle-orm';
import { db } from '@/db/client';
import { recordAgreement } from '@/db/queries/partner-agreements';
import type { DvNeedsAssessment } from '@/db/schema/dv-survivors';
import { dvSafetyEvents, dvSurvivors } from '@/db/schema/dv-survivors';
import type { DvRiskTier, DvSurvivorStatus } from '@/db/schema/enums';
import { partnerAgreements } from '@/db/schema/partner-agreements';
import { partnerOrgs } from '@/db/schema/partner-orgs';
import { users } from '@/db/schema/users';
import { OASIS_DEFAULT_REDACTION_POLICY, type OasisDsaTerms } from '@/lib/dtrs';

loadEnv({ path: ['.env.local', '.env'], override: true });

const { values } = parseArgs({
  options: {
    reset: { type: 'boolean', default: false },
  },
});

const OASIS_SLUG = 'oasis-shelter';

interface SyntheticSurvivor {
  caseSuffix: string;
  riskTier: DvRiskTier;
  status: DvSurvivorStatus;
  daysSinceEnrolled: number;
  safetyPlanOnFile: boolean;
  daysSincePlanReviewed: number | null;
  needs: DvNeedsAssessment;
}

const NEEDS_DEFAULT: DvNeedsAssessment = {
  housing: 'unknown',
  legal: 'unknown',
  childcare: 'unknown',
  employment: 'unknown',
  mental_health: 'unknown',
};

const SYNTHETIC_SURVIVORS: SyntheticSurvivor[] = [
  // High-risk active (lethality_high) — newest first
  {
    caseSuffix: 'A01',
    riskTier: 'lethality_high',
    status: 'active',
    daysSinceEnrolled: 2,
    safetyPlanOnFile: true,
    daysSincePlanReviewed: 1,
    needs: {
      ...NEEDS_DEFAULT,
      housing: 'in_progress',
      legal: 'in_progress',
      mental_health: 'in_progress',
    },
  },
  {
    caseSuffix: 'A02',
    riskTier: 'lethality_high',
    status: 'active',
    daysSinceEnrolled: 7,
    safetyPlanOnFile: true,
    daysSincePlanReviewed: 4,
    needs: {
      ...NEEDS_DEFAULT,
      housing: 'documented',
      legal: 'documented',
      childcare: 'in_progress',
    },
  },
  // Moderate-risk active
  {
    caseSuffix: 'B01',
    riskTier: 'lethality_moderate',
    status: 'active',
    daysSinceEnrolled: 14,
    safetyPlanOnFile: true,
    daysSincePlanReviewed: 12,
    needs: {
      ...NEEDS_DEFAULT,
      housing: 'in_progress',
      legal: 'in_progress',
      employment: 'searching',
    },
  },
  {
    caseSuffix: 'B02',
    riskTier: 'lethality_moderate',
    status: 'active',
    daysSinceEnrolled: 30,
    safetyPlanOnFile: true,
    daysSincePlanReviewed: 25,
    needs: {
      ...NEEDS_DEFAULT,
      housing: 'documented',
      legal: 'documented',
      employment: 'employed',
    },
  },
  {
    caseSuffix: 'B03',
    riskTier: 'lethality_moderate',
    status: 'active',
    daysSinceEnrolled: 45,
    safetyPlanOnFile: true,
    daysSincePlanReviewed: 40,
    needs: {
      ...NEEDS_DEFAULT,
      housing: 'in_progress',
      childcare: 'documented',
      mental_health: 'in_progress',
    },
  },
  // Low-risk active
  {
    caseSuffix: 'C01',
    riskTier: 'lethality_low',
    status: 'active',
    daysSinceEnrolled: 60,
    safetyPlanOnFile: true,
    daysSincePlanReviewed: 55,
    needs: { ...NEEDS_DEFAULT, housing: 'documented', legal: 'documented' },
  },
  {
    caseSuffix: 'C02',
    riskTier: 'lethality_low',
    status: 'active',
    daysSinceEnrolled: 75,
    safetyPlanOnFile: true,
    daysSincePlanReviewed: 70,
    needs: {
      ...NEEDS_DEFAULT,
      housing: 'documented',
      employment: 'employed',
      mental_health: 'documented',
    },
  },
  // Stale safety plan (Inngest job target — last reviewed > 90 days)
  {
    caseSuffix: 'D01',
    riskTier: 'lethality_moderate',
    status: 'active',
    daysSinceEnrolled: 120,
    safetyPlanOnFile: true,
    daysSincePlanReviewed: 100,
    needs: { ...NEEDS_DEFAULT, housing: 'documented' },
  },
  {
    caseSuffix: 'D02',
    riskTier: 'lethality_low',
    status: 'active',
    daysSinceEnrolled: 180,
    safetyPlanOnFile: true,
    daysSincePlanReviewed: 150,
    needs: { ...NEEDS_DEFAULT, housing: 'documented', employment: 'employed' },
  },
  // No safety plan on file
  {
    caseSuffix: 'E01',
    riskTier: 'unknown',
    status: 'active',
    daysSinceEnrolled: 1,
    safetyPlanOnFile: false,
    daysSincePlanReviewed: null,
    needs: NEEDS_DEFAULT,
  },
  // Exited (rehoused / connected)
  {
    caseSuffix: 'F01',
    riskTier: 'lethality_low',
    status: 'exited',
    daysSinceEnrolled: 200,
    safetyPlanOnFile: true,
    daysSincePlanReviewed: 60,
    needs: {
      ...NEEDS_DEFAULT,
      housing: 'documented',
      employment: 'employed',
      legal: 'documented',
    },
  },
  // Transferred to another shelter / agency
  {
    caseSuffix: 'G01',
    riskTier: 'lethality_high',
    status: 'transferred',
    daysSinceEnrolled: 90,
    safetyPlanOnFile: true,
    daysSincePlanReviewed: 60,
    needs: { ...NEEDS_DEFAULT, housing: 'in_progress', legal: 'in_progress' },
  },
  // Just-intaked (enrolled today, no needs assessment yet)
  {
    caseSuffix: 'H01',
    riskTier: 'unknown',
    status: 'active',
    daysSinceEnrolled: 0,
    safetyPlanOnFile: false,
    daysSincePlanReviewed: null,
    needs: NEEDS_DEFAULT,
  },
];

async function ensureOasisPartnerOrg(): Promise<string> {
  const [existing] = await db
    .select({ id: partnerOrgs.id })
    .from(partnerOrgs)
    .where(eq(partnerOrgs.slug, OASIS_SLUG))
    .limit(1);
  if (existing) return existing.id;

  const [created] = await db
    .insert(partnerOrgs)
    .values({
      name: 'OASIS Shelter',
      slug: OASIS_SLUG,
      type: 'shelter',
      description:
        'Domestic-violence program AND licensed women’s substance-use treatment. Location-confidential by design — coalition data design uses abuser-blind protocols here.',
      dataSharingTier: 'none',
    })
    .returning({ id: partnerOrgs.id });
  if (!created) throw new Error('failed to create OASIS partner_org');
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
      clerkUserId: 'seed_system_oasis',
      role: 'admin',
      firstName: 'System',
      lastName: 'Seed',
    })
    .returning({ id: users.id });
  if (!created) throw new Error('failed to create system seed user');
  return created.id;
}

async function ensureActiveOasisDsa(
  oasisPartnerOrgId: string,
  systemUserId: string,
): Promise<string> {
  const [existing] = await db
    .select({ id: partnerAgreements.id })
    .from(partnerAgreements)
    .where(
      and(
        eq(partnerAgreements.partnerOrgId, oasisPartnerOrgId),
        eq(partnerAgreements.kind, 'dsa'),
        eq(partnerAgreements.status, 'active'),
      ),
    )
    .limit(1);
  if (existing) return existing.id;

  const terms: OasisDsaTerms = {
    kind: 'dsa',
    agency: 'oasis',
    scope: [
      'survivor_intake_roster',
      'safety_plan_status',
      'service_referral_history',
      'risk_tier_only',
    ],
    agency_legal_name: 'Owensboro Area Shelter and Information Services, Inc.',
    agency_contact: {
      name: 'Synthetic Contact',
      title: 'Executive Director',
      email: 'ed@oasisshelter.example',
    },
    redaction_policy: OASIS_DEFAULT_REDACTION_POLICY,
    abuser_blind_attestation: true,
    data_destruction_due: 'on_termination',
  };

  const created = await recordAgreement({
    partnerOrgId: oasisPartnerOrgId,
    kind: 'dsa',
    status: 'active',
    effectiveDate: new Date().toISOString().slice(0, 10),
    endDate: null,
    signedByPartner: 'Synthetic Signer, OASIS',
    signedByCoalitionUserId: systemUserId,
    templateVersion: 'oasis-dsa-v1',
    templateRendered: null,
    terms,
    notes: 'Seeded by gen-synthetic-dv-survivors.ts',
    actorUserId: systemUserId,
  });
  return created.id;
}

async function maybeReset(oasisPartnerOrgId: string) {
  if (!values.reset) return;
  const synthetic = await db
    .select({ id: dvSurvivors.id })
    .from(dvSurvivors)
    .where(
      and(
        eq(dvSurvivors.oasisPartnerOrgId, oasisPartnerOrgId),
        like(dvSurvivors.oasisCaseId, 'SYNTH-OASIS-%'),
      ),
    );
  if (synthetic.length === 0) return;
  console.log(`Resetting ${synthetic.length} synthetic survivors (and their events via cascade)…`);
  for (const { id } of synthetic) {
    await db.delete(dvSafetyEvents).where(eq(dvSafetyEvents.survivorId, id));
    await db.delete(dvSurvivors).where(eq(dvSurvivors.id, id));
  }
}

function tsBefore(days: number, asOf: Date): Date {
  const d = new Date(asOf);
  d.setUTCDate(d.getUTCDate() - days);
  return d;
}

async function main() {
  console.log('SUBP-004 synthetic seed starting…');

  const oasisPartnerOrgId = await ensureOasisPartnerOrg();
  console.log(`  OASIS partner_org: ${oasisPartnerOrgId}`);

  const systemUserId = await ensureSystemUser();
  console.log(`  system seed user: ${systemUserId}`);

  const dsaId = await ensureActiveOasisDsa(oasisPartnerOrgId, systemUserId);
  console.log(`  active OASIS DSA: ${dsaId}`);

  await maybeReset(oasisPartnerOrgId);

  const asOf = new Date();
  let inserted = 0;
  let skipped = 0;

  for (const s of SYNTHETIC_SURVIVORS) {
    const caseId = `SYNTH-OASIS-${s.caseSuffix}`;

    const [existing] = await db
      .select({ id: dvSurvivors.id })
      .from(dvSurvivors)
      .where(eq(dvSurvivors.oasisCaseId, caseId))
      .limit(1);
    if (existing) {
      skipped += 1;
      continue;
    }

    const enrolledAt = tsBefore(s.daysSinceEnrolled, asOf);
    const safetyPlanLastReviewedAt =
      s.daysSincePlanReviewed === null ? null : tsBefore(s.daysSincePlanReviewed, asOf);

    const [created] = await db
      .insert(dvSurvivors)
      .values({
        oasisPartnerOrgId,
        oasisCaseId: caseId,
        enrolledAt,
        status: s.status,
        // Initially unassigned — admin pairs to a caseworker via the UI;
        // tests of the abuser-blind middleware exercise both branches.
        assignedAdvocateUserId: null,
        safetyPlanOnFile: s.safetyPlanOnFile,
        safetyPlanLastReviewedAt,
        needsAssessment: s.needs,
        riskTier: s.riskTier,
      })
      .returning({ id: dvSurvivors.id });
    if (!created) throw new Error(`insert failed for ${caseId}`);

    // Seed an intake event so the timeline isn't empty.
    await db.insert(dvSafetyEvents).values({
      survivorId: created.id,
      eventType: 'intake',
      occurredAt: enrolledAt,
      recordedByUserId: systemUserId,
      summary: 'intake_completed',
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
