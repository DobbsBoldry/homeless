#!/usr/bin/env tsx
/**
 * COOR-012 — synthetic case_handoffs seed.
 *
 * Idempotent. Re-running:
 *   - Ensures both `audubon-area-community-services` and `kla-owensboro`
 *     have an active `memo_of_cooperation` partner_agreement (so the
 *     governance gate clears).
 *   - Ensures person_partner_consents rows exist for the two handoffs
 *     that need them (synthetic refs SYN-HANDOFF-001 / SYN-HANDOFF-002).
 *   - Inserts ~5 case_handoffs spanning the lifecycle:
 *       1. pending_consent      — fresh, no consent yet.
 *       2. pending_acceptance   — consent on file, awaiting receiver.
 *       3. accepted             — receiver took it; loadHandoffContext OK.
 *       4. declined             — receiver said no.
 *       5. expired              — pre-acceptance row past expires_at.
 *
 * Usage:
 *   pnpm tsx scripts/gen-synthetic-handoffs.ts
 *   pnpm tsx scripts/gen-synthetic-handoffs.ts --reset
 *
 * --reset deletes existing synthetic handoffs (those with synthetic_person_ref
 * starting `SYN-HANDOFF-`) before re-seeding.
 */

import { parseArgs } from 'node:util';
import { config as loadEnv } from 'dotenv';
import { and, eq, like } from 'drizzle-orm';
import { db } from '@/db/client';
import { recordAgreement } from '@/db/queries/partner-agreements';
import { caseHandoffs } from '@/db/schema/case-handoffs';
import type { CaseHandoffScopeKind, CaseHandoffStatus } from '@/db/schema/enums';
import { partnerAgreements } from '@/db/schema/partner-agreements';
import { partnerOrgs } from '@/db/schema/partner-orgs';
import { personPartnerConsents } from '@/db/schema/person-partner-consents';
import { users } from '@/db/schema/users';

loadEnv({ path: ['.env.local', '.env'], override: true });

const { values } = parseArgs({
  options: {
    reset: { type: 'boolean', default: false },
  },
});

const FROM_SLUG = 'audubon-area-community-services';
const TO_SLUG = 'kla-owensboro';
const SYNTH_REF_PREFIX = 'SYN-HANDOFF-';

interface SyntheticHandoff {
  ref: string;
  status: CaseHandoffStatus;
  purpose: string;
  scope: CaseHandoffScopeKind[];
  needsConsent: boolean;
  daysToExpiry: number; // negative = already expired
  declineReason?: string;
}

const SYNTH: SyntheticHandoff[] = [
  {
    ref: `${SYNTH_REF_PREFIX}001`,
    status: 'pending_consent',
    purpose:
      'Client moved into KLA service area for an active eviction case; needs handoff for legal defense.',
    scope: ['intakes', 'case_notes'],
    needsConsent: false,
    daysToExpiry: 28,
  },
  {
    ref: `${SYNTH_REF_PREFIX}002`,
    status: 'pending_acceptance',
    purpose:
      'Consent on file; transferring case coordination after relocation. Awaiting KLA acceptance.',
    scope: ['intakes', 'case_notes', 'service_events'],
    needsConsent: true,
    daysToExpiry: 25,
  },
  {
    ref: `${SYNTH_REF_PREFIX}003`,
    status: 'accepted',
    purpose: 'Eviction defense handoff completed; receiver actively coordinating.',
    scope: ['intakes', 'case_notes', 'service_events', 'consents'],
    needsConsent: true,
    daysToExpiry: 22,
  },
  {
    ref: `${SYNTH_REF_PREFIX}004`,
    status: 'declined',
    purpose: 'Requested transfer of coordination after client relocation.',
    scope: ['intakes', 'case_notes'],
    needsConsent: true,
    daysToExpiry: 18,
    declineReason:
      'Client outside KLA jurisdiction — recommend referral to Legal Aid Society of Louisville.',
  },
  {
    ref: `${SYNTH_REF_PREFIX}005`,
    status: 'expired',
    purpose: 'Stale request; no consent ever recorded.',
    scope: ['intakes'],
    needsConsent: false,
    daysToExpiry: -3,
  },
];

async function findPartnerOrg(slug: string): Promise<string> {
  const rows = await db
    .select({ id: partnerOrgs.id })
    .from(partnerOrgs)
    .where(eq(partnerOrgs.slug, slug))
    .limit(1);
  if (!rows[0]) {
    throw new Error(`Partner org '${slug}' not found. Run pnpm tsx src/db/seed.ts first.`);
  }
  return rows[0].id;
}

async function ensureActiveMou(partnerOrgId: string, signerUserId: string): Promise<void> {
  // The handoff governance gate looks for ANY active partner_agreements row.
  // We seed a `mou` because it has a real validator; `memo_of_cooperation`
  // is a placeholder kind whose intake story hasn't shipped yet.
  const existing = await db
    .select({ id: partnerAgreements.id })
    .from(partnerAgreements)
    .where(
      and(
        eq(partnerAgreements.partnerOrgId, partnerOrgId),
        eq(partnerAgreements.kind, 'mou'),
        eq(partnerAgreements.status, 'active'),
      ),
    )
    .limit(1);
  if (existing[0]) return;
  await recordAgreement({
    partnerOrgId,
    kind: 'mou',
    status: 'active',
    effectiveDate: '2026-01-01',
    signedByPartner: 'Synthetic Coalition Coordinator',
    signedByCoalitionUserId: signerUserId,
    templateVersion: 'mou-phase1-v1',
    templateRendered:
      'Synthetic MOU between the coalition and the partner. ' +
      'Established for COOR-012 inter-agency handoff demo seeding.',
    terms: {
      kind: 'mou',
      phase: 'phase_1',
      monthly_meeting_hours: 1,
      withdrawal_notice_days: 30,
    },
    notes: 'Created by scripts/gen-synthetic-handoffs.ts',
    actorUserId: signerUserId,
  });
}

async function ensureConsent(syntheticPersonRef: string, partnerOrgId: string): Promise<string> {
  const existing = await db
    .select()
    .from(personPartnerConsents)
    .where(
      and(
        eq(personPartnerConsents.syntheticPersonRef, syntheticPersonRef),
        eq(personPartnerConsents.partnerOrgId, partnerOrgId),
      ),
    )
    .limit(1);
  if (existing[0]) {
    if (existing[0].revokedAt) {
      // Reset to unrevoked for the synthetic seed.
      await db
        .update(personPartnerConsents)
        .set({ revokedAt: null, updatedAt: new Date() })
        .where(eq(personPartnerConsents.id, existing[0].id));
    }
    return existing[0].id;
  }
  const inserted = await db
    .insert(personPartnerConsents)
    .values({
      syntheticPersonRef,
      partnerOrgId,
      notes: 'Synthetic seed for COOR-012 handoff demo.',
    })
    .returning();
  return inserted[0]!.id;
}

async function pickAnyUserId(): Promise<string> {
  const rows = await db.select({ id: users.id }).from(users).limit(1);
  if (!rows[0]) {
    throw new Error('No users in DB. Run pnpm tsx src/db/seed.ts first.');
  }
  return rows[0].id;
}

async function reset(): Promise<void> {
  await db
    .delete(caseHandoffs)
    .where(like(caseHandoffs.syntheticPersonRef, `${SYNTH_REF_PREFIX}%`));
  console.log(`[gen-synthetic-handoffs] cleared rows with ref like '${SYNTH_REF_PREFIX}%'`);
}

async function main() {
  if (values.reset) {
    await reset();
  }

  const fromOrgId = await findPartnerOrg(FROM_SLUG);
  const toOrgId = await findPartnerOrg(TO_SLUG);
  const userId = await pickAnyUserId();

  await Promise.all([ensureActiveMou(fromOrgId, userId), ensureActiveMou(toOrgId, userId)]);

  const now = new Date();
  for (const synth of SYNTH) {
    // Idempotency: skip if a handoff for this synthetic ref already exists.
    const existing = await db
      .select({ id: caseHandoffs.id })
      .from(caseHandoffs)
      .where(eq(caseHandoffs.syntheticPersonRef, synth.ref))
      .limit(1);
    if (existing[0]) {
      console.log(`[gen-synthetic-handoffs] skip ${synth.ref} (status=${synth.status}) — exists`);
      continue;
    }

    const consentId = synth.needsConsent ? await ensureConsent(synth.ref, toOrgId) : null;
    const expiresAt = new Date(now);
    expiresAt.setUTCDate(expiresAt.getUTCDate() + synth.daysToExpiry);

    const acceptedAt = synth.status === 'accepted' ? new Date(now) : null;
    const closedAt =
      synth.status === 'declined' || synth.status === 'expired' ? new Date(now) : null;
    const respondedByUserId =
      synth.status === 'accepted' || synth.status === 'declined' ? userId : null;

    await db.insert(caseHandoffs).values({
      syntheticPersonRef: synth.ref,
      fromPartnerOrgId: fromOrgId,
      toPartnerOrgId: toOrgId,
      initiatedByUserId: userId,
      respondedByUserId,
      status: synth.status,
      purpose: synth.purpose,
      requestedScope: synth.scope,
      consentId,
      declineReason: synth.declineReason ?? null,
      expiresAt,
      acceptedAt,
      closedAt,
    });
    console.log(`[gen-synthetic-handoffs] inserted ${synth.ref} (status=${synth.status})`);
  }

  console.log('[gen-synthetic-handoffs] done.');
}

main()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error(err);
    process.exit(1);
  });
