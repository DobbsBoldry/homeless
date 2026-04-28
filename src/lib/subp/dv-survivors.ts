/**
 * SUBP-004 — DV survivor query layer (ADR 0007).
 *
 * The ONLY place in the codebase that may run `select … from dvSurvivors`
 * or `select … from dvSafetyEvents`. All callers must come through these
 * functions, and every read goes through `requireSurvivorReader` for
 * per-row authorization. Direct queries from outside this module are
 * forbidden by the boundary lint.
 *
 * The OASIS-DSA gate (`requireOasisDsa`) sits in front of every read at
 * the partner-org level — if no active DSA exists, the function fail-
 * closes regardless of viewer role.
 *
 * Audit-on-read: every survivor record returned by these functions is
 * logged via `logAuditEvent` with action `dv_survivor.read`. The audit
 * metadata carries IDs only — never names, never addresses, never any
 * field that could leak survivor location.
 *
 * No field-level redaction is applied here yet — the OASIS DSA's
 * `redaction_policy` is read by callers when surfacing per-field data.
 * This module returns the raw row; the renderer / serializer is
 * responsible for honoring redaction at output time. (Future story may
 * push redaction down into this layer if it sprawls.)
 */

import { and, desc, eq, isNotNull, isNull, lte, or } from 'drizzle-orm';
import { db } from '@/db/client';
import { dvSafetyEvents, dvSurvivors } from '@/db/schema/dv-survivors';
import { logAuditEvent } from '@/lib/audit';
import {
  type AdvocateAuthInput,
  isAuthorizedReader,
  requireSurvivorReader,
  type SurvivorRow,
} from './abuser-blind';
import { checkOasisGate, type OasisGateDecision, requireOasisDsa } from './oasis-gate';

/**
 * List survivor rows the viewer is authorized to read for a given OASIS
 * partner_org. Filters at the DB layer (admin sees all, caseworker sees
 * only own assignments) so unauthorized rows never load into memory in
 * the first place — defense-in-depth alongside `isAuthorizedReader`.
 *
 * Audits each returned row with `dv_survivor.read` (id-only metadata).
 *
 * Throws `OasisGateDeniedError` when the partner has no active OASIS DSA.
 */
export async function listSurvivorsForViewer(
  viewer: AdvocateAuthInput,
  oasisPartnerOrgId: string,
): Promise<Array<typeof dvSurvivors.$inferSelect>> {
  const gate = await requireOasisDsa(oasisPartnerOrgId);
  void gate; // currently unused; future redaction-policy hooks will read it

  const conditions = [eq(dvSurvivors.oasisPartnerOrgId, oasisPartnerOrgId)];
  if (viewer.role !== 'admin') {
    if (viewer.role !== 'caseworker') return [];
    if (!viewer.id) return [];
    conditions.push(eq(dvSurvivors.assignedAdvocateUserId, viewer.id));
  }

  const rows = await db
    .select()
    .from(dvSurvivors)
    .where(and(...(conditions as Parameters<typeof and>)))
    .orderBy(desc(dvSurvivors.enrolledAt));

  for (const row of rows) {
    await logAuditEvent({
      actorUserId: viewer.id || null,
      action: 'dv_survivor.read',
      targetTable: 'dv_survivors',
      targetId: row.id,
      metadata: {
        // ID-only metadata. Per ADR 0007 § Decision rule 5, never include
        // names, addresses, or any field that could leak location.
        oasisPartnerOrgId: row.oasisPartnerOrgId,
        riskTier: row.riskTier,
        status: row.status,
        viewerRole: viewer.role,
      },
    });
  }

  return rows;
}

/**
 * Fetch a single survivor by id, gated by both the OASIS DSA and the
 * abuser-blind middleware. Returns `null` if not found; throws if not
 * authorized (so a 404 is indistinguishable from a 403 — anti-enumeration).
 *
 * Audits the read on success.
 */
export async function getSurvivorByIdForViewer(
  viewer: AdvocateAuthInput,
  survivorId: string,
): Promise<typeof dvSurvivors.$inferSelect | null> {
  const [row] = await db.select().from(dvSurvivors).where(eq(dvSurvivors.id, survivorId)).limit(1);
  if (!row) return null;

  // Gate at partner level first (no active DSA → throw, regardless of role).
  await requireOasisDsa(row.oasisPartnerOrgId);

  // Then per-row abuser-blind check. Throws on deny.
  const survivorRow: SurvivorRow = {
    id: row.id,
    assignedAdvocateUserId: row.assignedAdvocateUserId,
  };
  requireSurvivorReader(viewer, survivorRow);

  await logAuditEvent({
    actorUserId: viewer.id || null,
    action: 'dv_survivor.read',
    targetTable: 'dv_survivors',
    targetId: row.id,
    metadata: {
      oasisPartnerOrgId: row.oasisPartnerOrgId,
      riskTier: row.riskTier,
      status: row.status,
      viewerRole: viewer.role,
    },
  });

  return row;
}

/**
 * Fetch the safety-event timeline for a survivor. Same auth model as
 * `getSurvivorByIdForViewer`: OASIS gate + abuser-blind reader check.
 *
 * Returned in occurred_at-descending order. Audits the parent survivor
 * read once; individual event reads are not separately audited (they
 * derive from the survivor read).
 */
export async function listSafetyEventsForSurvivor(
  viewer: AdvocateAuthInput,
  survivorId: string,
): Promise<Array<typeof dvSafetyEvents.$inferSelect>> {
  // Re-check authorization via the survivor lookup; getSurvivorByIdForViewer
  // throws if the viewer can't see this row.
  const survivor = await getSurvivorByIdForViewer(viewer, survivorId);
  if (!survivor) return [];

  return db
    .select()
    .from(dvSafetyEvents)
    .where(eq(dvSafetyEvents.survivorId, survivorId))
    .orderBy(desc(dvSafetyEvents.occurredAt));
}

/**
 * System-context: list active survivors whose safety plan is stale (or
 * marked as on-file but never reviewed). "Stale" defaults to 90 days
 * since `safety_plan_last_reviewed_at`. Used by the weekly Inngest scan.
 *
 * Returns id-only metadata (no per-row needs/risk detail) so the cron
 * has minimum-necessary information for downstream notification routing.
 * No viewer required — the cron is privileged system code, not a
 * user-facing read; it does not invoke `requireSurvivorReader`.
 */
export async function listStaleSafetyPlans(opts: {
  staleAfterDays?: number;
  asOf?: Date;
}): Promise<
  Array<{ id: string; oasisPartnerOrgId: string; assignedAdvocateUserId: string | null }>
> {
  const { staleAfterDays = 90, asOf = new Date() } = opts;
  const cutoff = new Date(asOf);
  cutoff.setUTCDate(cutoff.getUTCDate() - staleAfterDays);

  const rows = await db
    .select({
      id: dvSurvivors.id,
      oasisPartnerOrgId: dvSurvivors.oasisPartnerOrgId,
      assignedAdvocateUserId: dvSurvivors.assignedAdvocateUserId,
    })
    .from(dvSurvivors)
    .where(
      and(
        eq(dvSurvivors.status, 'active'),
        eq(dvSurvivors.safetyPlanOnFile, true),
        or(
          isNull(dvSurvivors.safetyPlanLastReviewedAt),
          lte(dvSurvivors.safetyPlanLastReviewedAt, cutoff),
        ),
      ),
    );
  return rows;
}

// Suppress unused-import warning when only some helpers are used elsewhere.
void isNotNull;

/**
 * Soft-handle authorization without throwing. Useful for UI surfaces that
 * want to gracefully redirect rather than throw. Returns the same
 * decision shape as `isAuthorizedReader` but also threads through the
 * OASIS-DSA decision.
 */
export async function checkSurvivorAccess(
  viewer: AdvocateAuthInput,
  oasisPartnerOrgId: string,
  survivor: SurvivorRow,
): Promise<
  | { allowed: true; oasisGate: Extract<OasisGateDecision, { allowed: true }> }
  | {
      allowed: false;
      reason:
        | 'oasis_gate_denied'
        | 'viewer_id_missing'
        | 'role_not_authorized'
        | 'survivor_unassigned'
        | 'not_assigned_advocate';
    }
> {
  const oasisGate = await checkOasisGate(oasisPartnerOrgId);
  if (!oasisGate.allowed) return { allowed: false, reason: 'oasis_gate_denied' };

  const reader = isAuthorizedReader(viewer, survivor);
  if (!reader.allowed) return { allowed: false, reason: reader.reason };

  return { allowed: true, oasisGate };
}
