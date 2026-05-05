/**
 * COOR-012 — case_handoffs table.
 *
 * Inter-agency handoff primitive. One row per handoff request. The platform
 * (the coalition) mediates: an initiating agency asks a receiving agency to
 * take over (or share) coordination of a synthetic_person_ref. The receiver
 * cannot read context until two gates clear:
 *
 *   1. Both partner orgs have an active `partner_agreements` row with the
 *      coalition (governance gate).
 *   2. The subject has an unrevoked `person_partner_consents` grant for the
 *      receiving partner org (subject gate).
 *
 * Both gates are enforced in the domain library, not the schema. The DB
 * stores the request + lifecycle; reads of transferred context route through
 * `loadHandoffContext` which audits on every call.
 *
 * Bounded data flow: handoffs that sit in pre-acceptance states past
 * `expires_at` are aged out by the daily Inngest sweep
 * (`handoff-expiry-sweep.ts`). Terminal-state rows are kept for the audit
 * trail.
 *
 * The UI surfaces (caseworker inbox, case-page initiate button, accept /
 * decline buttons, notifications) are CWT-022 — this story is the primitive
 * underneath.
 */
import { sql } from 'drizzle-orm';
import { check, index, jsonb, pgTable, text, timestamp, uuid } from 'drizzle-orm/pg-core';
import { type CaseHandoffScopeKind, caseHandoffStatusEnum } from './enums';
import { partnerOrgs } from './partner-orgs';
import { personPartnerConsents } from './person-partner-consents';
import { users } from './users';

export const caseHandoffs = pgTable(
  'case_handoffs',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    /**
     * Opaque ref to the subject of the handoff. Matches the
     * `synthetic_person_ref` keyspace used by intakes / case notes /
     * service events / consents. Real-identity mapping lives outside the
     * platform until BAA + identity-management work.
     */
    syntheticPersonRef: text('synthetic_person_ref').notNull(),
    /** Initiating partner org. */
    fromPartnerOrgId: uuid('from_partner_org_id')
      .notNull()
      .references(() => partnerOrgs.id, { onDelete: 'restrict' }),
    /** Receiving partner org. */
    toPartnerOrgId: uuid('to_partner_org_id')
      .notNull()
      .references(() => partnerOrgs.id, { onDelete: 'restrict' }),
    /** Caseworker (member of the initiating org) who initiated the handoff. */
    initiatedByUserId: uuid('initiated_by_user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'restrict' }),
    /**
     * Acting caseworker on the receiving side. Set when the handoff
     * transitions out of `pending_acceptance` (accepted or declined).
     */
    respondedByUserId: uuid('responded_by_user_id').references(() => users.id, {
      onDelete: 'set null',
    }),
    status: caseHandoffStatusEnum('status').notNull().default('pending_consent'),
    /**
     * Initiator's reason for the handoff. Plain text. Visible to the
     * receiver — keep it operational ("relocating to receiver's service
     * area"), not diagnostic.
     */
    purpose: text('purpose').notNull(),
    /**
     * What kinds of records the receiver is permitted to read once the
     * handoff is accepted. Enforced by `loadHandoffContext`. Validated as
     * a non-empty array of `CaseHandoffScopeKind` before insert.
     */
    requestedScope: jsonb('requested_scope').$type<CaseHandoffScopeKind[]>().notNull(),
    /**
     * Link to the unrevoked person_partner_consents row that authorises
     * the receiver to see this person's data. Null while the row is in
     * `pending_consent`. Set when the subject grants consent (or when
     * the initiator confirms an existing grant covers this handoff).
     *
     * ON DELETE SET NULL: if the consent record is purged, the handoff
     * can no longer satisfy the subject gate; `loadHandoffContext` then
     * fails closed.
     */
    consentId: uuid('consent_id').references(() => personPartnerConsents.id, {
      onDelete: 'set null',
    }),
    /**
     * Receiver's stated reason if `status='declined'`. Free text.
     */
    declineReason: text('decline_reason'),
    /**
     * Soft expiration. Pre-acceptance rows past this are aged to `expired`
     * by the daily sweep. Default: 30 days post-creation; set by the
     * domain helper, not the DB.
     */
    expiresAt: timestamp('expires_at', { withTimezone: true }).notNull(),
    /** Set when status flips to `accepted`. */
    acceptedAt: timestamp('accepted_at', { withTimezone: true }),
    /** Set when status flips to a terminal non-accepted state. */
    closedAt: timestamp('closed_at', { withTimezone: true }),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    index('case_handoffs_to_partner_idx').on(t.toPartnerOrgId, t.status),
    index('case_handoffs_from_partner_idx').on(t.fromPartnerOrgId, t.status),
    index('case_handoffs_person_ref_idx').on(t.syntheticPersonRef),
    index('case_handoffs_status_idx').on(t.status),
    index('case_handoffs_expires_at_idx').on(t.expiresAt),
    // Receiver cannot equal initiator — a handoff to your own org is meaningless.
    check('case_handoffs_distinct_orgs', sql`from_partner_org_id <> to_partner_org_id`),
  ],
);

export type CaseHandoff = typeof caseHandoffs.$inferSelect;
export type NewCaseHandoff = typeof caseHandoffs.$inferInsert;
