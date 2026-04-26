import { index, jsonb, pgTable, text, timestamp, uuid } from 'drizzle-orm/pg-core';

/**
 * Append-only log of every inbound SMS the bed-finder webhook handled.
 * Identifiers are E.164 phone numbers — these ARE potentially identifying
 * info, so the log is access-restricted in the UI (admin-only) and never
 * leaves the DB. Body is stored verbatim for debugging the parser.
 *
 * Pre-BAA scope: synthetic / staff-test traffic only. When the unhoused-
 * companion goes live (post-BAA, post-consent flow), we'll either
 * suppress phone numbers here or run de-identification on the column.
 */
export const smsMessages = pgTable(
  'sms_messages',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    /** Twilio MessageSid — opaque, useful for correlating Twilio logs. */
    providerMessageId: text('provider_message_id'),
    fromNumber: text('from_number').notNull(),
    toNumber: text('to_number').notNull(),
    body: text('body').notNull(),
    /** Recognized intent; 'unknown' for messages we couldn't parse. */
    intent: text('intent').notNull(),
    /** Reply we sent back inline (TwiML). Useful for debugging. */
    replyBody: text('reply_body').notNull(),
    /** Free-form context the formatter / pipeline wrote. Optional. */
    metadata: jsonb('metadata').$type<Record<string, unknown> | null>(),
    receivedAt: timestamp('received_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    index('sms_messages_received_idx').on(t.receivedAt),
    index('sms_messages_from_idx').on(t.fromNumber),
  ],
);

export type SmsMessage = typeof smsMessages.$inferSelect;
export type NewSmsMessage = typeof smsMessages.$inferInsert;
