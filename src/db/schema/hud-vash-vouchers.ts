/**
 * SUBP-006b — HUD-VASH vouchers + per-veteran applications.
 *
 * `hud_vash_vouchers` is admin-managed seed data (manual entry) until the
 * DTRS-015 VA HUD-VASH DSA unlocks a live feed. `veteran_voucher_applications`
 * tracks which subject has applied to which voucher (one row per pair).
 *
 * PHI fence: synthetic data only until the relevant BAA closes.
 */
import {
  boolean,
  index,
  integer,
  pgEnum,
  pgTable,
  text,
  timestamp,
  uniqueIndex,
  uuid,
} from 'drizzle-orm/pg-core';
import { users } from './users';
import { veterans } from './veterans';

/** Availability of a voucher's unit. */
export const hudVashVoucherStatusEnum = pgEnum('hud_vash_voucher_status', [
  'available',
  'pending',
  'leased',
]);

export type HudVashVoucherStatus = (typeof hudVashVoucherStatusEnum.enumValues)[number];

export const hudVashVouchers = pgTable(
  'hud_vash_vouchers',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    /** Human-facing voucher identifier (e.g. PHA voucher number). */
    voucherCode: text('voucher_code').notNull(),
    /** Unit-type label shown in the UI (e.g. "1BR apartment"). */
    unitType: text('unit_type').notNull(),
    /** Bedroom count — the numeric input to match scoring. */
    bedrooms: integer('bedrooms').notNull(),
    /** Locality label (city/neighborhood). */
    location: text('location').notNull(),
    /** 5-digit ZIP — proximity input to match scoring; null = unknown. */
    zip: text('zip'),
    /** Whether the unit is accessible. */
    accessible: boolean('accessible').notNull().default(false),
    availabilityStatus: hudVashVoucherStatusEnum('availability_status')
      .notNull()
      .default('available'),
    notes: text('notes'),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [index('hud_vash_vouchers_status_idx').on(t.availabilityStatus)],
);

export type HudVashVoucher = typeof hudVashVouchers.$inferSelect;
export type NewHudVashVoucher = typeof hudVashVouchers.$inferInsert;

/**
 * Application status of a (veteran, voucher) pair. SUBP-006c extends the
 * lifecycle past applied/withdrawn so the caseworker pipeline view can show a
 * subject's stage (see `deriveVeteranVoucherStage`).
 */
export const veteranVoucherApplicationStatusEnum = pgEnum('veteran_voucher_application_status', [
  'applied',
  'pending',
  'approved',
  'housed',
  'withdrawn',
]);

export type VeteranVoucherApplicationStatus =
  (typeof veteranVoucherApplicationStatusEnum.enumValues)[number];

export const veteranVoucherApplications = pgTable(
  'veteran_voucher_applications',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    veteranId: uuid('veteran_id')
      .notNull()
      .references(() => veterans.id, { onDelete: 'cascade' }),
    voucherId: uuid('voucher_id')
      .notNull()
      .references(() => hudVashVouchers.id, { onDelete: 'cascade' }),
    status: veteranVoucherApplicationStatusEnum('status').notNull().default('applied'),
    /** Caseworker who recorded the application; null if system/seed. */
    appliedByUserId: uuid('applied_by_user_id').references(() => users.id, {
      onDelete: 'set null',
    }),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    uniqueIndex('veteran_voucher_applications_unique_idx').on(t.veteranId, t.voucherId),
    index('veteran_voucher_applications_veteran_idx').on(t.veteranId),
  ],
);

export type VeteranVoucherApplication = typeof veteranVoucherApplications.$inferSelect;
export type NewVeteranVoucherApplication = typeof veteranVoucherApplications.$inferInsert;
