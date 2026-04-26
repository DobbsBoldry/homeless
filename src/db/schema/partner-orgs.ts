import { boolean, pgTable, text, timestamp, uniqueIndex, uuid } from 'drizzle-orm/pg-core';
import { dataSharingTierEnum, partnerOrgTypeEnum } from './enums';

export const partnerOrgs = pgTable(
  'partner_orgs',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    name: text('name').notNull(),
    slug: text('slug').notNull(),
    type: partnerOrgTypeEnum('type').notNull(),
    contactEmail: text('contact_email'),
    contactPhone: text('contact_phone'),
    website: text('website'),
    /** 1-2 sentence summary for the coalition directory page. */
    description: text('description'),
    /**
     * Phase-1 placeholder for the coalition data-trust governance.
     * Defaults to 'none' (no data flowing yet); coalition agreements
     * raise this to 'aggregate' (anonymized service counts) or
     * 'individual' (consent-gated per-person data).
     */
    dataSharingTier: dataSharingTierEnum('data_sharing_tier').notNull().default('none'),
    active: boolean('active').notNull().default(true),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [uniqueIndex('partner_orgs_slug_idx').on(t.slug)],
);

export type PartnerOrg = typeof partnerOrgs.$inferSelect;
export type NewPartnerOrg = typeof partnerOrgs.$inferInsert;
