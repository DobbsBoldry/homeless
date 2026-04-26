import { index, pgTable, text, timestamp, uniqueIndex, uuid } from 'drizzle-orm/pg-core';
import { evictionResponsePacketStatusEnum } from './enums';
import { evictionFilings } from './eviction-filings';
import { users } from './users';

/**
 * AI-drafted Answer to Forcible Detainer Complaint, generated from a
 * filing by the EVDT-012 service. One row per (filing_id, prompt_version)
 * — re-running the generator with the same prompt version no-ops via the
 * unique index. Bumping prompt_version inserts a new draft alongside the
 * old; an attorney can compare versions during prompt iteration.
 *
 * Status flow:
 *   draft (default) -> approved -> filed
 *                  \-> rejected
 *
 * `generated_by_user_id` is the attorney who triggered the generation;
 * SET NULL on user delete so the packet survives staff turnover.
 */
export const evictionResponsePackets = pgTable(
  'eviction_response_packets',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    filingId: uuid('filing_id')
      .notNull()
      .references(() => evictionFilings.id, { onDelete: 'cascade' }),
    packetMd: text('packet_md').notNull(),
    promptVersion: text('prompt_version').notNull(),
    generatedByUserId: uuid('generated_by_user_id').references(() => users.id, {
      onDelete: 'set null',
    }),
    status: evictionResponsePacketStatusEnum('status').notNull().default('draft'),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    uniqueIndex('response_packets_filing_version_idx').on(t.filingId, t.promptVersion),
    index('response_packets_filing_idx').on(t.filingId),
    index('response_packets_status_idx').on(t.status),
  ],
);

export type EvictionResponsePacket = typeof evictionResponsePackets.$inferSelect;
export type NewEvictionResponsePacket = typeof evictionResponsePackets.$inferInsert;
