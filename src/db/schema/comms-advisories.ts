import { boolean, index, pgTable, text, timestamp, uuid } from 'drizzle-orm/pg-core';
import { users } from './users';

/**
 * OPRT-010: communications coordination during a crisis or
 * sensitive news cycle. The coalition's policy: speak with one
 * voice during incidents (a fatal exposure death, a controversial
 * partner action, a political moment). This table is that policy
 * made operational.
 *
 * One row per advisory. When `active = true`, every signed-in user
 * sees a sticky banner pointing to the advisory page. Staff can read
 * the agreed statement, find the designated spokesperson, and avoid
 * speaking publicly themselves.
 *
 * Posting and ending are explicit actions; nothing auto-expires.
 * Coalition leads pick when an incident is over.
 */
export const commsAdvisories = pgTable(
  'comms_advisories',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    title: text('title').notNull(),
    /** Markdown body — the agreed statement, key talking points, what NOT to say. */
    bodyMd: text('body_md').notNull(),
    /** Who's authorized to speak publicly during this advisory. */
    spokespersonName: text('spokesperson_name').notNull(),
    spokespersonContact: text('spokesperson_contact'),
    /** True while the advisory is in effect. Only one active at a time. */
    active: boolean('active').notNull().default(true),
    postedByUserId: uuid('posted_by_user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'restrict' }),
    /** Set when the advisory is ended (active flips to false). */
    endedAt: timestamp('ended_at', { withTimezone: true }),
    endedByUserId: uuid('ended_by_user_id').references(() => users.id, {
      onDelete: 'set null',
    }),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    index('comms_advisories_active_idx').on(t.active),
    index('comms_advisories_created_idx').on(t.createdAt),
  ],
);

export type CommsAdvisory = typeof commsAdvisories.$inferSelect;
export type NewCommsAdvisory = typeof commsAdvisories.$inferInsert;
