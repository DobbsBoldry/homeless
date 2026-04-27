import { jsonb, pgTable, serial, text, timestamp } from 'drizzle-orm/pg-core';

/**
 * E2E-only sink for outbound messages. Populated when E2E_MOCK_OUTBOUND=1 and
 * the instrumentation fetch interceptor catches a Twilio or Resend request.
 * Tests assert against this table to verify "the app would have sent X."
 *
 * Empty in dev and prod (the interceptor is a no-op when the flag is unset).
 */
export const outboundMessagesTest = pgTable('outbound_messages_test', {
  id: serial('id').primaryKey(),
  kind: text('kind').notNull(), // 'twilio.sms' | 'resend.email'
  to: text('to').notNull(),
  body: text('body').notNull(),
  metadata: jsonb('metadata').$type<Record<string, unknown>>().notNull().default({}),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
});

export type OutboundMessageTest = typeof outboundMessagesTest.$inferSelect;
export type NewOutboundMessageTest = typeof outboundMessagesTest.$inferInsert;
