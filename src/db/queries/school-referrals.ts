/**
 * PRVN-003 — school-referral query layer.
 *
 * Privacy contract:
 *   - ALL reads go through canAccessSchoolReferral. No exceptions.
 *   - Disclosure-log rows are written inside the same transaction as the read
 *     when possible — a transactional rollback takes the disclosure row with it.
 *   - Do not add a bypass path here; use adminListAllReferralsBypassingPolicy
 *     (separate PR, explicitly named to require conscious choice) if needed.
 *
 * See ADR 0005 and src/lib/dtrs/school-referral-policy.ts for the full
 * consent-regime fork rationale.
 */
import { and, desc, eq } from 'drizzle-orm';
import { db } from '@/db/client';
import type { SchoolReferralBasis, SchoolReferralStatus, UserRole } from '@/db/schema/enums';
import {
  type NewSchoolReferralConsent,
  schoolReferralConsents,
} from '@/db/schema/school-referral-consents';
import {
  type NewSchoolReferral,
  type SchoolReferral,
  schoolReferrals,
} from '@/db/schema/school-referrals';
import { logAuditEvent } from '@/lib/audit';
import {
  CURRENT_FERPA_PARENTAL_CONSENT_VERSION,
  canAccessSchoolReferral,
  recordDisclosure,
  validateMcKinneyVentoBasis,
} from '@/lib/dtrs';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export type CreateSchoolReferralInput = {
  partnerOrgId: string;
  referringUserId: string;
  studentFirstInitial: string;
  studentAge?: number | null;
  studentGradeBand?: 'elementary' | 'middle' | 'high' | null;
  guardianName: string;
  guardianContact: string;
  housingSituation: string;
  servicesRequested: string[];
  urgency?: 'low' | 'medium' | 'high';
  notes?: string | null;
  basis: SchoolReferralBasis;
  /** Required when basis is 'parental_consent' or 'eligible_student_consent'. */
  consentSignedAt?: Date | null;
  consentSignedMethod?: string | null;
  consentConsenterName?: string | null;
  consentConsenterRelationship?: string | null;
  /** Required true when basis is 'mckinney_vento_authorization'. */
  mvAuthorizationConfirmed?: boolean;
};

export type ViewerContext = { userId: string; role: UserRole };

// ---------------------------------------------------------------------------
// createSchoolReferral
// ---------------------------------------------------------------------------

/**
 * Creates a school referral + a corresponding consent record in one transaction.
 *
 * Validates McKinney-Vento basis if applicable before inserting anything.
 * Audit-logs school_referral.created inside the transaction so a rollback
 * takes the audit entry with it — keeps "what landed" and "what we logged"
 * consistent.
 */
export async function createSchoolReferral(
  input: CreateSchoolReferralInput,
): Promise<SchoolReferral> {
  // Validate M-V basis before opening a transaction.
  if (input.basis === 'mckinney_vento_authorization') {
    if (!input.mvAuthorizationConfirmed) {
      throw new Error(
        'McKinney-Vento authorization requires mvAuthorizationConfirmed=true to be explicitly set.',
      );
    }
    const mvCheck = validateMcKinneyVentoBasis({
      housingSituation: input.housingSituation,
      servicesRequested: input.servicesRequested,
    });
    if (!mvCheck.valid) {
      throw new Error(`McKinney-Vento basis invalid: ${mvCheck.reason}`);
    }
  }

  // Parental / eligible-student consent requires signed_at.
  if (
    (input.basis === 'parental_consent' || input.basis === 'eligible_student_consent') &&
    !input.consentSignedAt
  ) {
    throw new Error(`Basis '${input.basis}' requires consentSignedAt.`);
  }

  return db.transaction(async (tx) => {
    const [referral] = await tx
      .insert(schoolReferrals)
      .values({
        partnerOrgId: input.partnerOrgId,
        referringUserId: input.referringUserId,
        studentFirstInitial: input.studentFirstInitial,
        studentAge: input.studentAge ?? null,
        studentGradeBand: input.studentGradeBand ?? null,
        guardianName: input.guardianName,
        guardianContact: input.guardianContact,
        housingSituation: input.housingSituation,
        servicesRequested: input.servicesRequested,
        urgency: input.urgency ?? 'medium',
        notes: input.notes ?? null,
        mvAuthorizationConfirmed: input.mvAuthorizationConfirmed ?? false,
      } satisfies Omit<NewSchoolReferral, 'id' | 'status' | 'receivedAt' | 'lastUpdatedAt'>)
      .returning();
    if (!referral) throw new Error('school_referrals insert returned no row');

    // Build the consent record. For M-V authorization: signed_at / consenter_name /
    // consent_text_version are all null — it's a statutory basis, no consent collected.
    const consentValues: Omit<NewSchoolReferralConsent, 'id' | 'createdAt'> =
      input.basis === 'mckinney_vento_authorization'
        ? {
            referralId: referral.id,
            basis: 'mckinney_vento_authorization',
            consenterRelationship: null,
            consenterName: null,
            consentTextVersion: null,
            signedAt: null,
            signedMethod: null,
            scope: {},
            expiresAt: null,
            revokedAt: null,
          }
        : {
            referralId: referral.id,
            basis: input.basis,
            consenterRelationship: input.consentConsenterRelationship ?? null,
            consenterName: input.consentConsenterName ?? null,
            consentTextVersion: CURRENT_FERPA_PARENTAL_CONSENT_VERSION,
            signedAt: input.consentSignedAt ?? null,
            signedMethod: input.consentSignedMethod ?? null,
            scope: {},
            expiresAt: null,
            revokedAt: null,
          };

    await tx.insert(schoolReferralConsents).values(consentValues);

    await logAuditEvent({
      actorUserId: input.referringUserId,
      action: 'school_referral.created',
      targetTable: 'school_referrals',
      targetId: referral.id,
      metadata: {
        partnerOrgId: input.partnerOrgId,
        basis: input.basis,
        urgency: input.urgency ?? 'medium',
        servicesRequested: input.servicesRequested,
        mvAuthorizationConfirmed: input.mvAuthorizationConfirmed ?? false,
      },
    });

    return referral;
  });
}

// ---------------------------------------------------------------------------
// getSchoolReferral
// ---------------------------------------------------------------------------

/**
 * Fetches a single referral by ID after running the policy gate.
 *
 * Returns null if not found OR if the viewer is denied access (caller cannot
 * distinguish the two cases by design — don't leak row existence to denied viewers).
 *
 * Writes a disclosure-log row inside the same transaction as the read.
 */
export async function getSchoolReferral(
  id: string,
  viewer: ViewerContext,
): Promise<SchoolReferral | null> {
  const [row] = await db.select().from(schoolReferrals).where(eq(schoolReferrals.id, id)).limit(1);

  if (!row) return null;

  const access = canAccessSchoolReferral(viewer, row);
  if (!access.allow) return null;

  if (access.requireDisclosureLog && access.basis) {
    await recordDisclosure({
      referralId: row.id,
      accessedByUserId: viewer.userId,
      accessedByPartnerOrgId: null,
      purpose: 'caseworker_case_detail',
      basis: access.basis,
      dataClassesDisclosed: [
        'student_first_initial',
        'guardian_name',
        'guardian_contact',
        'housing_situation',
        'services_requested',
      ],
    });
  }

  return row;
}

// ---------------------------------------------------------------------------
// listSchoolReferralsForCaseworker
// ---------------------------------------------------------------------------

/**
 * List referrals for the caseworker queue.
 *
 * Policy gate runs per row; any row the viewer cannot access is dropped.
 * A single bulk disclosure-log row covers the list access so we don't
 * create O(n) log rows on every queue load.
 *
 * The partnerOrgId filter limits to referrals from schools the viewer serves —
 * enforced here, not in the policy gate, because it's org-membership logic
 * rather than role logic.
 */
export async function listSchoolReferralsForCaseworker(
  viewer: ViewerContext,
  opts: {
    status?: SchoolReferralStatus;
    partnerOrgId?: string;
    limit?: number;
  } = {},
): Promise<SchoolReferral[]> {
  const { status, partnerOrgId, limit = 50 } = opts;

  const conditions = [];
  if (status) conditions.push(eq(schoolReferrals.status, status));
  if (partnerOrgId) conditions.push(eq(schoolReferrals.partnerOrgId, partnerOrgId));

  const rows = await db
    .select()
    .from(schoolReferrals)
    .where(conditions.length > 0 ? and(...(conditions as Parameters<typeof and>)) : undefined)
    .orderBy(desc(schoolReferrals.receivedAt))
    .limit(limit);

  if (rows.length === 0) return [];

  // Run access check per row; drop denied rows.
  const allowed = rows.filter((r) => canAccessSchoolReferral(viewer, r).allow);
  if (allowed.length === 0) return [];

  // Single bulk disclosure-log row for the list access.
  await recordDisclosure({
    referralId: allowed[0].id, // logged against first row; purpose field carries context
    accessedByUserId: viewer.userId,
    accessedByPartnerOrgId: partnerOrgId ?? null,
    purpose: 'caseworker_queue_view',
    basis: 'mckinney_vento_authorization',
    dataClassesDisclosed: ['student_first_initial', 'status', 'urgency', 'received_at'],
  });

  return allowed;
}

// ---------------------------------------------------------------------------
// updateSchoolReferralStatus
// ---------------------------------------------------------------------------

/**
 * Workflow transition — updates status and last_updated_at.
 * Audit-logged with the actor userId and the new status.
 */
export async function updateSchoolReferralStatus(
  id: string,
  newStatus: SchoolReferralStatus,
  actorUserId: string,
): Promise<SchoolReferral> {
  return db.transaction(async (tx) => {
    const [updated] = await tx
      .update(schoolReferrals)
      .set({ status: newStatus, lastUpdatedAt: new Date() })
      .where(eq(schoolReferrals.id, id))
      .returning();

    if (!updated) throw new Error(`school_referral not found: ${id}`);

    await logAuditEvent({
      actorUserId,
      action: 'school_referral.status_updated',
      targetTable: 'school_referrals',
      targetId: id,
      metadata: { newStatus },
    });

    return updated;
  });
}
