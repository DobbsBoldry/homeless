import { index, jsonb, pgTable, text, timestamp, uniqueIndex, uuid } from 'drizzle-orm/pg-core';
import type { BedFilter } from '@/lib/coordination/bed-availability';
import { smsConversationStateEnum } from './enums';

/**
 * One row per inbound phone number. Tracks the multi-turn state of the
 * SMS bed-finder (INDC-004): the user's first BED message becomes a
 * pending filter while we ask "where are you near?", and the reply is
 * stitched back to the original filter to produce the bed list.
 *
 * Conversations time out after 10 minutes of inactivity. The Inngest
 * cron (sms-conversation-expiry) flips stale rows back to `idle` so
 * we don't strand users in the awaiting-location state forever.
 */
export const smsConversations = pgTable(
  'sms_conversations',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    fromNumber: text('from_number').notNull(),
    state: smsConversationStateEnum('state').notNull().default('idle'),
    /** The most recent BED filter the user expressed; replayed when location arrives. */
    pendingFilter: jsonb('pending_filter').$type<BedFilter | null>(),
    /** Captured location text from the last 'awaiting_location' reply. Free-form. */
    lastLocation: text('last_location'),
    /**
     * The shelter ids and display order from the most recent bed-finder
     * reply, in the same order they appeared. Lets `HOLD <#>` map a
     * line number back to a shelter without re-running the search.
     */
    lastResults: jsonb('last_results').$type<Array<{ shelterId: string; name: string }>>(),
    /** Most recent active hold the user created via SMS, for RELEASE shortcuts. */
    lastHoldId: uuid('last_hold_id'),
    /** When the conversation auto-expires back to 'idle'. */
    expiresAt: timestamp('expires_at', { withTimezone: true }).notNull(),
    lastMessageAt: timestamp('last_message_at', { withTimezone: true }).notNull().defaultNow(),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    uniqueIndex('sms_conversations_from_idx').on(t.fromNumber),
    index('sms_conversations_state_idx').on(t.state),
    index('sms_conversations_expires_idx').on(t.expiresAt),
  ],
);

export type SmsConversation = typeof smsConversations.$inferSelect;
export type NewSmsConversation = typeof smsConversations.$inferInsert;
