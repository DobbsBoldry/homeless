import * as Sentry from '@sentry/nextjs';
import { db as defaultDb } from '@/db/client';
import { auditLog } from '@/db/schema/audit-log';

// Derive the transaction handle type from the db client so callers get full
// type-safety without importing a Drizzle internal directly.
type Tx = Parameters<Parameters<typeof defaultDb.transaction>[0]>[0];

export type AuditAction =
  | 'user.created'
  | 'user.updated'
  | 'user.deleted'
  | 'consent.granted'
  | 'consent.revoked'
  | 'org_membership.added'
  | 'org_membership.removed'
  | 'person_partner_consent.revoked'
  | 'person_partner_consent.regranted'
  | (string & {}); // allow new actions without enum churn — keep narrow types for known ones

export interface LogAuditEventInput {
  /** UUID of the user who took the action. Null/undefined for system events. */
  actorUserId?: string | null;
  /** Dot-notated action name. See `AuditAction` for known values. */
  action: AuditAction;
  /** Polymorphic target (e.g. table name + row id). Optional. */
  targetTable?: string;
  targetId?: string;
  /** Arbitrary JSON metadata. Avoid PHI here. */
  metadata?: Record<string, unknown>;
  /**
   * Optional transaction handle. When provided, the audit insert runs inside
   * this transaction and rolls back if the transaction fails. When omitted,
   * the insert runs against the top-level db client (best-effort; failures are
   * caught and Sentry-logged).
   */
  tx?: Tx;
}

/**
 * Append-only audit log writer. Use from server components, server actions,
 * and webhooks to record significant events.
 *
 * Pass `tx` when calling from inside a `db.transaction(async (tx) => { ... })`
 * block — the audit row will roll back atomically with the enclosing transaction.
 *
 * When `tx` is omitted the write is best-effort: failures are logged + reported
 * to Sentry as a tagged warning but never thrown. Set up a Sentry alert on tag
 * `audit_write=failed` to catch silent dropouts.
 */
export async function logAuditEvent(input: LogAuditEventInput): Promise<void> {
  const dbHandle = input.tx ?? defaultDb;
  try {
    await dbHandle.insert(auditLog).values({
      actorUserId: input.actorUserId ?? null,
      action: input.action,
      targetTable: input.targetTable,
      targetId: input.targetId,
      metadata: input.metadata,
    });
  } catch (err) {
    console.error('[audit] write failed', { input, err });
    Sentry.captureException(err, {
      level: 'warning',
      tags: { audit_write: 'failed', audit_action: input.action },
      // Action name is safe to attach (a controlled enum). Don't attach
      // metadata — it may contain PHI-shaped fields once Phase 1 lands.
      extra: { audit_action: input.action },
    });
  }
}
