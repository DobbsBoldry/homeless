import { sql } from 'drizzle-orm';
import { check, date, index, jsonb, pgTable, text, timestamp, uuid } from 'drizzle-orm/pg-core';
import type { PartnerAgreementTerms } from '@/lib/dtrs';
import { partnerAgreementKindEnum, partnerAgreementStatusEnum } from './enums';
import { partnerOrgs } from './partner-orgs';
import { users } from './users';

/**
 * Polymorphic registry of all coalition partner agreements.
 * One row per agreement regardless of kind (FERPA, MOU, BAA, QSOA, DSA,
 * memo_of_cooperation). See ADR 0004 for design rationale.
 *
 * `template_rendered` is the legal artifact — set once at signing and treated
 * as immutable by convention. No edit path is exposed for signed rows.
 *
 * `terms` JSONB is kind-specific structured metadata, typed at the application
 * layer via `PartnerAgreementTerms` discriminated union. The DB stores the
 * raw JSON; the domain lib enforces the shape.
 */
export const partnerAgreements = pgTable(
  'partner_agreements',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    partnerOrgId: uuid('partner_org_id')
      .notNull()
      .references(() => partnerOrgs.id, { onDelete: 'restrict' }),
    kind: partnerAgreementKindEnum('kind').notNull(),
    status: partnerAgreementStatusEnum('status').notNull().default('draft'),
    effectiveDate: date('effective_date'),
    endDate: date('end_date'),
    /** Name and role of the partner-org signatory. */
    signedByPartner: text('signed_by_partner'),
    signedByCoalitionUserId: uuid('signed_by_coalition_user_id').references(() => users.id, {
      onDelete: 'set null',
    }),
    /**
     * Template identifier, e.g. "ferpa-v1", "mou-phase0-v2".
     * Links this row to the rendered template the partner reviewed.
     */
    templateVersion: text('template_version'),
    /**
     * The rendered legal text the partner reviewed and signed.
     * Immutable after signing — do NOT expose an edit path on rows
     * with status='active' (see ADR 0004 consequences).
     */
    templateRendered: text('template_rendered'),
    /**
     * Kind-specific structured terms. Shape is enforced by
     * `validateAgreementTerms` in the domain lib before insert.
     * Not the legal instrument (that's `template_rendered`).
     */
    terms: jsonb('terms')
      .$type<PartnerAgreementTerms>()
      .notNull()
      .default({} as PartnerAgreementTerms),
    notes: text('notes'),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    index('partner_agreements_partner_idx').on(t.partnerOrgId),
    index('partner_agreements_kind_status_idx').on(t.kind, t.status),
    index('partner_agreements_active_idx').on(t.status).where(sql`status = 'active'`),
    check(
      'partner_agreements_date_order',
      sql`effective_date IS NULL OR end_date IS NULL OR effective_date <= end_date`,
    ),
  ],
);

export type PartnerAgreement = typeof partnerAgreements.$inferSelect;
export type NewPartnerAgreement = typeof partnerAgreements.$inferInsert;
