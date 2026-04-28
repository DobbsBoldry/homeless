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
import { and, desc, eq, inArray } from 'drizzle-orm';
import { db } from '@/db/client';
import type { SchoolReferralBasis, SchoolReferralStatus, UserRole } from '@/db/schema/enums';
import { orgMemberships } from '@/db/schema/org-memberships';
import { partnerOrgs } from '@/db/schema/partner-orgs';
import {
  type NewSchoolReferralConsent,
  schoolReferralConsents,
} from '@/db/schema/school-referral-consents';
import {
  type SchoolReferralStatusEvent,
  schoolReferralStatusEvents,
} from '@/db/schema/school-referral-status-events';
import {
  type NewSchoolReferral,
  type SchoolReferral,
  schoolReferrals,
} from '@/db/schema/school-referrals';
import { logAuditEvent } from '@/lib/audit';
import {
  CURRENT_FERPA_ELIGIBLE_STUDENT_CONSENT_VERSION,
  CURRENT_FERPA_PARENTAL_CONSENT_VERSION,
  canAccessSchoolReferral,
  MCKINNEY_VENTO_CONSENT_VERSION_SENTINEL,
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
 * Audit-logs school_referral.created inside the transaction (tx passed to
 * logAuditEvent) so a rollback takes the audit entry with it — keeps "what
 * landed" and "what we logged" consistent. (DTRS-010 pattern.)
 *
 * For M-V authorization basis the consent record's consent_text_version is
 * set to the sentinel 'mckinney_vento_v1' — statutory authorization, not a
 * consent text, but the column stays NOT NULL for structural self-documentation.
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

    // Build the consent record. For M-V authorization: signed_at, consenter_name,
    // and signed_method are null (statutory basis, no consent collected).
    // consent_text_version uses the sentinel 'mckinney_vento_v1' — NOT NULL by
    // schema; the sentinel self-documents the statutory basis (see ADR 0005, Issue 4 fix).
    const consentValues: Omit<NewSchoolReferralConsent, 'id' | 'createdAt'> =
      input.basis === 'mckinney_vento_authorization'
        ? {
            referralId: referral.id,
            basis: 'mckinney_vento_authorization',
            consenterRelationship: null,
            consenterName: null,
            consentTextVersion: MCKINNEY_VENTO_CONSENT_VERSION_SENTINEL,
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
            consentTextVersion:
              input.basis === 'eligible_student_consent'
                ? CURRENT_FERPA_ELIGIBLE_STUDENT_CONSENT_VERSION
                : CURRENT_FERPA_PARENTAL_CONSENT_VERSION,
            signedAt: input.consentSignedAt ?? null,
            signedMethod: input.consentSignedMethod ?? null,
            scope: {},
            expiresAt: null,
            revokedAt: null,
          };

    await tx.insert(schoolReferralConsents).values(consentValues);

    // Audit log is written inside the transaction (tx passed) so a rollback
    // takes the audit row with it — DTRS-010 pattern.
    await logAuditEvent({
      tx,
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
 * For non-admin viewers (caseworker / ed_coordinator), also checks that the
 * viewer has an active membership in the referral's partner org. Admins bypass
 * the membership check — they have org-wide oversight for FERPA compliance.
 *
 * Access-denied attempts (viewer has the right role but lacks membership) write
 * a disclosure-log row with purpose 'access_denied' so the attempt is traceable.
 */
export async function getSchoolReferral(
  id: string,
  viewer: ViewerContext,
): Promise<SchoolReferral | null> {
  return db.transaction(async (tx) => {
    const [row] = await tx
      .select()
      .from(schoolReferrals)
      .where(eq(schoolReferrals.id, id))
      .limit(1);

    if (!row) return null;

    const access = canAccessSchoolReferral(viewer, row);

    // Role-level denial (attorney, shelter_staff, pending) — write audit trail
    // so probes are traceable. No disclosure-log row needed (FERPA § 99.32 logs
    // disclosures, not denials — audit log is sufficient here).
    if (!access.allow) {
      await logAuditEvent({
        tx,
        actorUserId: viewer.userId,
        action: 'school_referral.access_denied_role',
        targetTable: 'school_referrals',
        targetId: row.id,
        metadata: { viewer_role: viewer.role, basis: 'role_denied' },
      });
      return null;
    }

    // For non-admin viewers enforce partner-org membership — only caseworkers
    // assigned to the referral's school can view it.
    if (viewer.role !== 'admin') {
      const [membership] = await tx
        .select({ id: orgMemberships.id })
        .from(orgMemberships)
        .where(
          and(
            eq(orgMemberships.userId, viewer.userId),
            eq(orgMemberships.partnerOrgId, row.partnerOrgId),
          ),
        )
        .limit(1);

      if (!membership) {
        // Log the attempt — a missing disclosure trail is a FERPA compliance gap.
        if (access.requireDisclosureLog && access.basis) {
          await recordDisclosure({
            tx,
            referralId: row.id,
            accessedByUserId: viewer.userId,
            accessedByPartnerOrgId: null,
            purpose: 'access_denied',
            basis: access.basis,
            dataClassesDisclosed: [],
          });
        }
        return null;
      }
    }

    if (access.requireDisclosureLog && access.basis) {
      await recordDisclosure({
        tx,
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
  });
}

// ---------------------------------------------------------------------------
// listSchoolReferralsForCaseworker
// ---------------------------------------------------------------------------

/**
 * List referrals for the caseworker queue.
 *
 * Policy gate runs per row; any row the viewer cannot access is dropped.
 * One disclosure-log row is written per returned referral, each carrying the
 * referral's actual consent basis (FERPA § 99.32 — one row per disclosure).
 * This requires joining school_referral_consents to resolve the basis per row.
 *
 * The partnerOrgId filter limits to referrals from schools the viewer serves —
 * enforced here, not in the policy gate, because it's org-membership logic
 * rather than role logic.
 *
 * Caller MUST verify the viewer is a member of `partnerOrgId` before calling —
 * this query does not enforce membership; it filters on the provided id.
 * Full membership enforcement is deferred to a follow-up story.
 *
 * The SELECT and all disclosure-log writes happen inside one transaction so a
 * disclosure-write failure rolls back the read — FERPA § 99.32 traceable.
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

  const conditions: ReturnType<typeof eq>[] = [];
  if (status) conditions.push(eq(schoolReferrals.status, status));
  if (partnerOrgId) conditions.push(eq(schoolReferrals.partnerOrgId, partnerOrgId));

  return db.transaction(async (tx) => {
    // Join with consents to get each referral's actual basis for per-row
    // disclosure logging (FERPA § 99.32 requires per-disclosure accuracy).
    const rowsWithBasis = await tx
      .select({
        referral: schoolReferrals,
        basis: schoolReferralConsents.basis,
      })
      .from(schoolReferrals)
      .innerJoin(schoolReferralConsents, eq(schoolReferralConsents.referralId, schoolReferrals.id))
      .where(conditions.length > 0 ? and(...(conditions as Parameters<typeof and>)) : undefined)
      .orderBy(desc(schoolReferrals.receivedAt))
      .limit(limit);

    if (rowsWithBasis.length === 0) return [];

    // Run access check per row; drop denied rows.
    const allowed = rowsWithBasis.filter(
      ({ referral }) => canAccessSchoolReferral(viewer, referral).allow,
    );
    if (allowed.length === 0) return [];

    // Write one disclosure-log row per returned referral, each carrying the
    // referral's actual basis — FERPA § 99.32 requires per-disclosure logging
    // and the basis must accurately reflect the authorization for that referral.
    for (const { referral, basis } of allowed) {
      await recordDisclosure({
        tx,
        referralId: referral.id,
        accessedByUserId: viewer.userId,
        accessedByPartnerOrgId: partnerOrgId ?? null,
        purpose: 'caseworker_queue_view',
        basis,
        dataClassesDisclosed: ['student_first_initial', 'status', 'urgency', 'received_at'],
      });
    }

    return allowed.map(({ referral }) => referral);
  });
}

// ---------------------------------------------------------------------------
// updateSchoolReferralStatus
// ---------------------------------------------------------------------------

/**
 * Workflow transition — updates status, writes an event row, and audit-logs.
 *
 * COOR-014 extension: accepts an optional `confirmationNote` (max 500 chars
 * enforced here; DB CHECK allows 1 000 as defense-in-depth). The note is
 * stored in school_referral_status_events — what the school liaison sees.
 *
 * Privacy: note content MUST NOT appear in audit-log metadata. Logs carry
 * only counts and IDs — the note may contain family-specific detail.
 *
 * All writes (school_referrals update, status_events insert, audit log) share
 * the same transaction so a rollback is atomic — DTRS-010 pattern.
 */
export async function updateSchoolReferralStatus(
  id: string,
  newStatus: SchoolReferralStatus,
  actorUserId: string,
  opts: { confirmationNote?: string } = {},
): Promise<SchoolReferral> {
  const { confirmationNote } = opts;

  if (confirmationNote !== undefined && confirmationNote.length > 500) {
    throw new Error('Confirmation note must be 500 characters or fewer.');
  }

  return db.transaction(async (tx) => {
    // Read the current status so we can capture from_status in the event row.
    const [current] = await tx
      .select({ status: schoolReferrals.status })
      .from(schoolReferrals)
      .where(eq(schoolReferrals.id, id))
      .limit(1);

    if (!current) throw new Error(`school_referral not found: ${id}`);

    const [updated] = await tx
      .update(schoolReferrals)
      .set({ status: newStatus, lastUpdatedAt: new Date() })
      .where(eq(schoolReferrals.id, id))
      .returning();

    if (!updated) throw new Error(`school_referral update returned no row: ${id}`);

    // Append one event row per transition — COOR-014 append-only log.
    // Note content is stored here but NEVER echoed into the audit-log metadata below.
    await tx.insert(schoolReferralStatusEvents).values({
      referralId: id,
      fromStatus: current.status,
      toStatus: newStatus,
      actorUserId,
      note: confirmationNote ?? null,
    });

    // Audit log is written inside the transaction (tx passed) so a rollback
    // takes the audit row with it — DTRS-010 pattern.
    // Metadata: counts and IDs only — no note content (COOR-014 privacy posture).
    await logAuditEvent({
      tx,
      actorUserId,
      action: 'school_referral.status_updated',
      targetTable: 'school_referrals',
      targetId: id,
      metadata: {
        fromStatus: current.status,
        toStatus: newStatus,
        hasNote: confirmationNote !== undefined && confirmationNote.length > 0,
      },
    });

    return updated;
  });
}

// ---------------------------------------------------------------------------
// getSchoolReferralStatusEvents
// ---------------------------------------------------------------------------

/**
 * Returns all status events for a referral, newest first.
 *
 * Caller must have already verified access (the policy gate runs at the
 * referral level — see getSchoolReferral / listReferralsForLiaison).
 * This is an internal helper; do not expose it directly from the barrel.
 */
export async function getSchoolReferralStatusEvents(
  referralId: string,
): Promise<SchoolReferralStatusEvent[]> {
  return db
    .select()
    .from(schoolReferralStatusEvents)
    .where(eq(schoolReferralStatusEvents.referralId, referralId))
    .orderBy(desc(schoolReferralStatusEvents.occurredAt));
}

// ---------------------------------------------------------------------------
// listReferralsForLiaison
// ---------------------------------------------------------------------------

export type ReferralWithLatestEvent = SchoolReferral & {
  latestEvent: SchoolReferralStatusEvent | null;
};

/**
 * List referrals for a McKinney-Vento school liaison dashboard (COOR-014).
 *
 * Membership is enforced INSIDE this function (unlike listSchoolReferralsForCaseworker
 * which deferred that to the caller). Returns only referrals from school orgs
 * the viewer is an active member of.
 *
 * Each returned row includes the latest status event so the dashboard can show
 * the most recent caseworker note without a second round-trip.
 *
 * One disclosure-log row is written per returned referral (FERPA § 99.32),
 * each carrying the referral's actual consent basis. All reads + disclosure
 * writes share one transaction.
 *
 * Note content is intentionally returned in full here (it is the liaison's
 * view of their own referral); it MUST NOT appear in audit-log metadata.
 */
export async function listReferralsForLiaison(
  viewer: ViewerContext,
): Promise<ReferralWithLatestEvent[]> {
  // Resolve the viewer's school org memberships first — outside the transaction,
  // since this is a lookup, not a write, and we need the result to scope the query.
  const schoolOrgRows = await db
    .select({ partnerOrgId: orgMemberships.partnerOrgId })
    .from(orgMemberships)
    .innerJoin(partnerOrgs, eq(orgMemberships.partnerOrgId, partnerOrgs.id))
    .where(
      and(
        eq(orgMemberships.userId, viewer.userId),
        eq(partnerOrgs.type, 'school'),
        eq(partnerOrgs.active, true),
      ),
    );

  if (schoolOrgRows.length === 0) return [];

  const schoolOrgIds = schoolOrgRows.map((r) => r.partnerOrgId);

  return db.transaction(async (tx) => {
    // Join with consents to get each referral's actual basis for per-row
    // disclosure logging (FERPA § 99.32 — one row per disclosure, basis accurate).
    const rowsWithBasis = await tx
      .select({
        referral: schoolReferrals,
        basis: schoolReferralConsents.basis,
      })
      .from(schoolReferrals)
      .innerJoin(schoolReferralConsents, eq(schoolReferralConsents.referralId, schoolReferrals.id))
      .where(inArray(schoolReferrals.partnerOrgId, schoolOrgIds))
      .orderBy(desc(schoolReferrals.receivedAt))
      .limit(200); // pilot-scale ceiling; no pagination yet (out of scope)

    if (rowsWithBasis.length === 0) return [];

    // Policy gate — drop any rows the viewer's role cannot see.
    const allowed = rowsWithBasis.filter(
      ({ referral }) => canAccessSchoolReferral(viewer, referral).allow,
    );
    if (allowed.length === 0) return [];

    // Fetch the latest status event per referral in one query.
    const referralIds = allowed.map(({ referral }) => referral.id);
    const allEvents = await tx
      .select()
      .from(schoolReferralStatusEvents)
      .where(inArray(schoolReferralStatusEvents.referralId, referralIds))
      .orderBy(desc(schoolReferralStatusEvents.occurredAt));

    // Build a map: referralId → latest event (first occurrence per referral in
    // the desc-ordered result is the most recent).
    const latestEventMap = new Map<string, SchoolReferralStatusEvent>();
    for (const evt of allEvents) {
      if (!latestEventMap.has(evt.referralId)) {
        latestEventMap.set(evt.referralId, evt);
      }
    }

    // Write disclosure-log rows — one per returned referral, each with the
    // referral's actual basis (FERPA § 99.32 per-disclosure accuracy requirement).
    // Liaison dashboard purpose and data classes scoped to what is actually shown.
    for (const { referral, basis } of allowed) {
      await recordDisclosure({
        tx,
        referralId: referral.id,
        accessedByUserId: viewer.userId,
        accessedByPartnerOrgId: referral.partnerOrgId,
        purpose: 'liaison_dashboard_view',
        basis,
        dataClassesDisclosed: [
          'student_first_initial',
          'student_age',
          'status',
          'received_at',
          'status_event_note',
        ],
      });
    }

    return allowed.map(({ referral }) => ({
      ...referral,
      latestEvent: latestEventMap.get(referral.id) ?? null,
    }));
  });
}
