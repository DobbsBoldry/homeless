/**
 * COOR-012 — case_handoffs query layer.
 *
 * All DB I/O for the handoff state machine lives here. The domain library
 * (`src/lib/coor/handoff.ts`) imports these and adds business logic +
 * audit. This split lets us mock the DB at the query boundary in tests
 * (mirrors the dcbs-gate / kydoc-gate pattern).
 */

import { and, eq, inArray, isNull, lte } from 'drizzle-orm';
import { db } from '@/db/client';
import { type CaseHandoff, caseHandoffs, type NewCaseHandoff } from '@/db/schema/case-handoffs';
import type { CaseHandoffStatus } from '@/db/schema/enums';
import { orgMemberships } from '@/db/schema/org-memberships';
import { partnerAgreements } from '@/db/schema/partner-agreements';
import { partnerOrgs } from '@/db/schema/partner-orgs';
import {
  type PersonPartnerConsent,
  personPartnerConsents,
} from '@/db/schema/person-partner-consents';

type Tx = Parameters<Parameters<typeof db.transaction>[0]>[0];
type DbHandle = typeof db | Tx;

export interface OrgGateState {
  id: string;
  active: boolean;
  hasActiveAgreement: boolean;
}

/**
 * Single-org governance lookup. Returns null when the org doesn't exist.
 * Used by `assertHandoffPermitted` to gate both sides of a handoff.
 */
export async function loadOrgGateState(orgId: string): Promise<OrgGateState | null> {
  const orgRows = await db
    .select({ id: partnerOrgs.id, active: partnerOrgs.active })
    .from(partnerOrgs)
    .where(eq(partnerOrgs.id, orgId))
    .limit(1);
  const org = orgRows[0];
  if (!org) return null;

  const active = await db
    .select({ id: partnerAgreements.id })
    .from(partnerAgreements)
    .where(and(eq(partnerAgreements.partnerOrgId, orgId), eq(partnerAgreements.status, 'active')))
    .limit(1);

  return {
    id: org.id,
    active: org.active,
    hasActiveAgreement: active.length > 0,
  };
}

export async function getCaseHandoff(handoffId: string): Promise<CaseHandoff | null> {
  const rows = await db.select().from(caseHandoffs).where(eq(caseHandoffs.id, handoffId)).limit(1);
  return rows[0] ?? null;
}

export async function insertCaseHandoff(
  value: NewCaseHandoff,
  handle: DbHandle = db,
): Promise<CaseHandoff> {
  const rows = await handle.insert(caseHandoffs).values(value).returning();
  return rows[0]!;
}

export interface UpdateCaseHandoffPatch {
  status?: CaseHandoffStatus;
  consentId?: string | null;
  respondedByUserId?: string | null;
  declineReason?: string | null;
  acceptedAt?: Date | null;
  closedAt?: Date | null;
}

export async function updateCaseHandoff(
  handoffId: string,
  patch: UpdateCaseHandoffPatch,
  handle: DbHandle = db,
): Promise<CaseHandoff> {
  const rows = await handle
    .update(caseHandoffs)
    .set({ ...patch, updatedAt: new Date() })
    .where(eq(caseHandoffs.id, handoffId))
    .returning();
  return rows[0]!;
}

/**
 * Person-partner consent lookup, filtered to unrevoked rows. Null result
 * means either the row doesn't exist or it's been revoked — both of which
 * deny the handoff context read by design.
 */
export async function getActivePersonPartnerConsent(
  consentId: string,
): Promise<PersonPartnerConsent | null> {
  const rows = await db
    .select()
    .from(personPartnerConsents)
    .where(and(eq(personPartnerConsents.id, consentId), isNull(personPartnerConsents.revokedAt)))
    .limit(1);
  return rows[0] ?? null;
}

/**
 * Plain consent fetch (revoked or not). The context loader needs this so
 * the gate can distinguish 'not found' from 'revoked'.
 */
export async function getPersonPartnerConsent(
  consentId: string,
): Promise<PersonPartnerConsent | null> {
  const rows = await db
    .select()
    .from(personPartnerConsents)
    .where(eq(personPartnerConsents.id, consentId))
    .limit(1);
  return rows[0] ?? null;
}

export async function userBelongsToOrg(userId: string, partnerOrgId: string): Promise<boolean> {
  const rows = await db
    .select({ id: orgMemberships.id })
    .from(orgMemberships)
    .where(and(eq(orgMemberships.userId, userId), eq(orgMemberships.partnerOrgId, partnerOrgId)))
    .limit(1);
  return rows.length > 0;
}

/**
 * Pre-acceptance handoffs whose `expires_at` is on or before `cutoff`.
 * The Inngest sweep iterates these and flips them to `expired`.
 */
export async function listExpiringPreAcceptanceHandoffs(cutoff: Date): Promise<CaseHandoff[]> {
  return db
    .select()
    .from(caseHandoffs)
    .where(
      and(
        lte(caseHandoffs.expiresAt, cutoff),
        inArray(caseHandoffs.status, ['pending_consent', 'pending_acceptance']),
      ),
    );
}
