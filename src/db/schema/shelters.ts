import { sql } from 'drizzle-orm';
import {
  boolean,
  check,
  index,
  integer,
  pgTable,
  text,
  timestamp,
  uniqueIndex,
  uuid,
} from 'drizzle-orm/pg-core';
import { partnerOrgs } from './partner-orgs';

/**
 * A shelter facility operated by a coalition partner. Holds the
 * operational state (capacity, live occupancy, accepts-which-populations)
 * that drives the live bed availability board (COOR-003) and the
 * SMS bed finder (INDC-001+).
 *
 * `partner_org_id` is the directory anchor — name/contact/website live
 * on `partner_orgs`. Multiple shelter facilities can belong to one
 * partner org (e.g. an org running both a men's and a family shelter).
 *
 * `current_occupancy` is updated by shelter staff via the bed-count UI
 * (COOR-002); changes are appended to `bed_count_updates` for audit.
 */
export const shelters = pgTable(
  'shelters',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    partnerOrgId: uuid('partner_org_id')
      .notNull()
      .references(() => partnerOrgs.id, { onDelete: 'restrict' }),
    name: text('name').notNull(),
    slug: text('slug').notNull(),
    addressLine1: text('address_line1'),
    city: text('city'),
    state: text('state'),
    postalCode: text('postal_code'),
    contactPhone: text('contact_phone'),
    /** Total bed capacity. */
    capacity: integer('capacity').notNull(),
    /** Beds currently occupied. Updated by staff via COOR-002. */
    currentOccupancy: integer('current_occupancy').notNull().default(0),
    acceptsMen: boolean('accepts_men').notNull().default(false),
    acceptsWomen: boolean('accepts_women').notNull().default(false),
    acceptsFamilies: boolean('accepts_families').notNull().default(false),
    petFriendly: boolean('pet_friendly').notNull().default(false),
    sudFriendly: boolean('sud_friendly').notNull().default(false),
    /** Hide from public board (under maintenance, off-season, etc). */
    active: boolean('active').notNull().default(true),
    notes: text('notes'),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    uniqueIndex('shelters_slug_idx').on(t.slug),
    index('shelters_partner_org_idx').on(t.partnerOrgId),
    check('shelters_capacity_nonneg', sql`${t.capacity} >= 0`),
    check('shelters_occupancy_nonneg', sql`${t.currentOccupancy} >= 0`),
    check('shelters_occupancy_le_capacity', sql`${t.currentOccupancy} <= ${t.capacity}`),
  ],
);

export type Shelter = typeof shelters.$inferSelect;
export type NewShelter = typeof shelters.$inferInsert;

/**
 * Append-only log of bed-count updates. Each update records who set
 * the new occupancy and when. The current value lives on
 * `shelters.current_occupancy`; this table is the audit trail.
 *
 * COOR-002 writes one row per update; COOR-005 (holds) does NOT
 * write here — bed holds are tracked separately.
 */
export const bedCountUpdates = pgTable(
  'bed_count_updates',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    shelterId: uuid('shelter_id')
      .notNull()
      .references(() => shelters.id, { onDelete: 'cascade' }),
    /** Clerk user id of the staff member who recorded the update. */
    updatedByUserId: text('updated_by_user_id').notNull(),
    previousOccupancy: integer('previous_occupancy').notNull(),
    newOccupancy: integer('new_occupancy').notNull(),
    note: text('note'),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    index('bed_count_updates_shelter_idx').on(t.shelterId),
    index('bed_count_updates_created_idx').on(t.createdAt),
  ],
);

export type BedCountUpdate = typeof bedCountUpdates.$inferSelect;
export type NewBedCountUpdate = typeof bedCountUpdates.$inferInsert;
