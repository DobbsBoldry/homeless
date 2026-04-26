import { index, jsonb, pgTable, text, timestamp, uuid } from 'drizzle-orm/pg-core';
import { users } from './users';

/**
 * Immutable record of significant system actions. Append-only — never UPDATE
 * or DELETE rows here. Use `logAuditEvent` from src/lib/audit.ts to write.
 *
 * Append-only is enforced at the DB level by triggers in migration
 * 0008_audit_log_append_only — `db.delete(auditLog)` and
 * `db.update(auditLog).set(...)` will raise `feature_not_supported`.
 * The application code is the convention; the trigger is the guarantee.
 *
 * Designed to outlive table renames: target_table + target_id are strings,
 * not foreign keys (polymorphic).
 */
export const auditLog = pgTable(
  'audit_log',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    actorUserId: uuid('actor_user_id').references(() => users.id, { onDelete: 'set null' }),
    action: text('action').notNull(), // e.g. 'user.created', 'consent.granted'
    targetTable: text('target_table'),
    targetId: text('target_id'),
    metadata: jsonb('metadata').$type<Record<string, unknown>>(),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    index('audit_log_actor_idx').on(t.actorUserId),
    index('audit_log_action_idx').on(t.action),
    index('audit_log_created_at_idx').on(t.createdAt),
  ],
);

export type AuditLog = typeof auditLog.$inferSelect;
export type NewAuditLog = typeof auditLog.$inferInsert;
