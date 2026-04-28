import type { AnyPgColumn } from 'drizzle-orm/pg-core';
import { index, integer, pgTable, text, timestamp, uniqueIndex, uuid } from 'drizzle-orm/pg-core';
import { faithMinistryStatusEnum } from './enums';
import { partnerOrgs } from './partner-orgs';

/**
 * A faith-based ministry that has opted in to share aggregate-only data
 * with the coalition. Per ADR 0003 (and `strategy/data.html` § 6 — Faith-
 * based aggregate data), this is the only data flow that does NOT carry
 * individual identifiers under any circumstance — counts only.
 *
 * `partner_org_id` is optional. The Catholic Charities umbrella will
 * exist in `partner_orgs`, but many small parish ministries opt in
 * without a formal partner-org row. `umbrella_ministry_id` lets us
 * roll sub-ministries (Aid the Homeless, Feeding Our Friends) up to
 * their parent.
 *
 * `min_cell_size` is the per-ministry k-anonymity threshold applied at
 * submission time. Default 10 (the OMU standard from `strategy/data.html`);
 * sensitive ministries may set higher. Counts < this are stored as NULL
 * with `suppressed=true` in the metrics/breakouts tables.
 */
export const faithMinistries = pgTable(
  'faith_ministries',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    partnerOrgId: uuid('partner_org_id').references(() => partnerOrgs.id, {
      onDelete: 'set null',
    }),
    name: text('name').notNull(),
    umbrellaMinistryId: uuid('umbrella_ministry_id').references(
      (): AnyPgColumn => faithMinistries.id,
      { onDelete: 'set null' },
    ),
    contactName: text('contact_name'),
    contactEmail: text('contact_email'),
    contactPhone: text('contact_phone'),
    status: faithMinistryStatusEnum('status').notNull().default('opted_in'),
    minCellSize: integer('min_cell_size').notNull().default(10),
    optedInAt: timestamp('opted_in_at', { withTimezone: true }).notNull().defaultNow(),
    optedOutAt: timestamp('opted_out_at', { withTimezone: true }),
    notes: text('notes'),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    uniqueIndex('faith_ministries_name_idx').on(t.name),
    index('faith_ministries_umbrella_idx').on(t.umbrellaMinistryId),
    index('faith_ministries_status_idx').on(t.status),
  ],
);

export type FaithMinistry = typeof faithMinistries.$inferSelect;
export type NewFaithMinistry = typeof faithMinistries.$inferInsert;
