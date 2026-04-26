import { boolean, pgTable, text, timestamp, uniqueIndex, uuid } from 'drizzle-orm/pg-core';
import { partnerOrgTypeEnum } from './enums';

export const partnerOrgs = pgTable(
  'partner_orgs',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    name: text('name').notNull(),
    slug: text('slug').notNull(),
    type: partnerOrgTypeEnum('type').notNull(),
    contactEmail: text('contact_email'),
    contactPhone: text('contact_phone'),
    active: boolean('active').notNull().default(true),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [uniqueIndex('partner_orgs_slug_idx').on(t.slug)],
);

export type PartnerOrg = typeof partnerOrgs.$inferSelect;
export type NewPartnerOrg = typeof partnerOrgs.$inferInsert;
