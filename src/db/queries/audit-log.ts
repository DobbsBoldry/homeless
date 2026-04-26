import { and, desc, eq, ilike, type SQL, sql } from 'drizzle-orm';
import { db } from '@/db/client';
import { type AuditLog, auditLog } from '@/db/schema/audit-log';
import { users } from '@/db/schema/users';

export type AuditLogRow = AuditLog & {
  actorEmail: string | null;
  actorRole: string | null;
};

export type AuditLogFilter = {
  /** Substring match against `action` (e.g. 'data.accessed', 'consent'). */
  action?: string;
  /** Match against target_id (one resource id). */
  targetId?: string;
  /** Match against target_table. */
  targetTable?: string;
  limit?: number;
};

/**
 * Recent audit-log rows joined with the actor's email/role for display.
 * Append-only triggers prevent any sneaky UPDATEs slipping past this
 * read view; what's here is the truth at write time.
 */
export async function listAuditLog(filter: AuditLogFilter = {}): Promise<AuditLogRow[]> {
  const conditions: SQL[] = [];
  if (filter.action) conditions.push(ilike(auditLog.action, `%${filter.action}%`));
  if (filter.targetId) conditions.push(eq(auditLog.targetId, filter.targetId));
  if (filter.targetTable) conditions.push(eq(auditLog.targetTable, filter.targetTable));

  const rows = await db
    .select({
      log: auditLog,
      actorEmail: users.email,
      actorRole: users.role,
    })
    .from(auditLog)
    .leftJoin(users, eq(auditLog.actorUserId, users.id))
    .where(conditions.length > 0 ? and(...conditions) : sql`true`)
    .orderBy(desc(auditLog.createdAt))
    .limit(filter.limit ?? 100);

  return rows.map((r) => ({
    ...r.log,
    actorEmail: r.actorEmail,
    actorRole: r.actorRole,
  }));
}

/**
 * Per-(action, day) counts over the last `windowDays` days. Used by
 * the DTRS-003 dashboard headline (\"24 reads, 6 grants, 0 deletes
 * yesterday\").
 */
export type AuditCountByActionDay = {
  action: string;
  day: string;
  count: number;
};

export async function actionCountsByDay(windowDays = 7): Promise<AuditCountByActionDay[]> {
  const rows = await db.execute(sql`
    SELECT
      action,
      to_char(date_trunc('day', created_at AT TIME ZONE 'UTC'), 'YYYY-MM-DD') AS day,
      COUNT(*)::int AS count
    FROM ${auditLog}
    WHERE created_at >= now() - (${windowDays} || ' days')::interval
    GROUP BY 1, 2
    ORDER BY 2 ASC, 1 ASC
  `);
  return (rows as unknown as Array<{ action: string; day: string; count: number }>).map((r) => ({
    action: r.action,
    day: r.day,
    count: Number(r.count),
  }));
}
