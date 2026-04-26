import { index, pgTable, text, timestamp, uuid } from 'drizzle-orm/pg-core';
import { edEncounterSourceEnum, partnerServiceEventTypeEnum } from './enums';
import { partnerOrgs } from './partner-orgs';

/**
 * One row per service-event reported by a coalition partner. Phase-1
 * stub: synthetic data only, populated by the seed for the demo.
 *
 * `synthetic_person_ref` is OPAQUE by design — never a name, email, or
 * phone. Today it's a synthetic ID like SYN-PERSON-001. Post-Phase-2
 * (when the data-trust governance lands), real linking happens via
 * a hash of consent-gated identifiers held inside the trust steward,
 * not by this platform. The platform only ever sees the opaque ref.
 *
 * The `source` enum borrows the ed_encounter source pattern: today
 * 'synthetic'; future ingest path could be a partner upload or an
 * MCP-style integration. We keep it simple — same enum.
 */
export const partnerServiceEvents = pgTable(
  'partner_service_events',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    partnerOrgId: uuid('partner_org_id')
      .notNull()
      .references(() => partnerOrgs.id, { onDelete: 'cascade' }),
    /** Opaque cross-org reference. NEVER a real name. */
    syntheticPersonRef: text('synthetic_person_ref').notNull(),
    eventType: partnerServiceEventTypeEnum('event_type').notNull(),
    eventAt: timestamp('event_at', { withTimezone: true }).notNull(),
    notes: text('notes'),
    source: edEncounterSourceEnum('source').notNull().default('synthetic'),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    index('partner_service_events_person_idx').on(t.syntheticPersonRef),
    index('partner_service_events_partner_idx').on(t.partnerOrgId),
    index('partner_service_events_at_idx').on(t.eventAt),
  ],
);

export type PartnerServiceEvent = typeof partnerServiceEvents.$inferSelect;
export type NewPartnerServiceEvent = typeof partnerServiceEvents.$inferInsert;
