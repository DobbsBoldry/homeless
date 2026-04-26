import { db } from '@/db/client';
import { auditLog } from '@/db/schema/audit-log';

export type AuditAction =
  | 'user.created'
  | 'user.updated'
  | 'user.deleted'
  | 'consent.granted'
  | 'consent.revoked'
  | 'org_membership.added'
  | 'org_membership.removed'
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
}

/**
 * Append-only audit log writer. Use from server components, server actions,
 * and webhooks to record significant events.
 *
 * Failures are logged but never throw — audit must never break the user-facing
 * action. (We trade observability for availability; an alert on missing-audit
 * dropouts comes in FND-006.)
 */
export async function logAuditEvent(input: LogAuditEventInput): Promise<void> {
  try {
    await db.insert(auditLog).values({
      actorUserId: input.actorUserId ?? null,
      action: input.action,
      targetTable: input.targetTable,
      targetId: input.targetId,
      metadata: input.metadata,
    });
  } catch (err) {
    console.error('[audit] write failed', { input, err });
  }
}
