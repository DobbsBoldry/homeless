import { date, index, jsonb, pgTable, text, timestamp, uuid } from 'drizzle-orm/pg-core';
import { users } from './users';

/**
 * OPRT-008: Steering Committee meeting templates + minutes recorder.
 *
 * One row per meeting. Fields are intentionally loose Markdown rather
 * than structured agenda/decision tables — the coalition's first year
 * is going to surface a lot of structure that doesn't exist yet, and
 * a free-text Markdown body is fastest to keep up with that.
 *
 * Phase-2 extensions: split decisions out into a `coalition_decisions`
 * table (OPRT-003 in the backlog), capture vote counts per decision,
 * link action items to follow-up Linear / GitHub issues. Tracked as
 * follow-up after we see what shape the coalition's actual cadence
 * settles into.
 */
export const steeringMeetings = pgTable(
  'steering_meetings',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    title: text('title').notNull(),
    /** Calendar date the meeting was held. Stored as date (no time). */
    heldOn: date('held_on').notNull(),
    /** Attendee names + roles. JSON because composition varies meeting-to-meeting. */
    attendees: jsonb('attendees').$type<Array<{ name: string; affiliation?: string }>>().notNull(),
    agendaMd: text('agenda_md').notNull().default(''),
    decisionsMd: text('decisions_md').notNull().default(''),
    actionItemsMd: text('action_items_md').notNull().default(''),
    /**
     * When the minutes were "posted" (made shareable beyond the recorder).
     * null = still a draft. Posting is one-way; revisions add a `notes`
     * trail rather than re-posting.
     */
    postedAt: timestamp('posted_at', { withTimezone: true }),
    createdByUserId: uuid('created_by_user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'restrict' }),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    index('steering_meetings_held_on_idx').on(t.heldOn),
    index('steering_meetings_created_by_idx').on(t.createdByUserId),
  ],
);

export type SteeringMeeting = typeof steeringMeetings.$inferSelect;
export type NewSteeringMeeting = typeof steeringMeetings.$inferInsert;
