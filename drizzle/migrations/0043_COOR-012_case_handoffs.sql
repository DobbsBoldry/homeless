-- COOR-012 — inter-agency consent-gated handoff primitive.
--
-- One table: `case_handoffs`. Two new enums: `case_handoff_status`,
-- `case_handoff_scope_kind`. The state machine + gates live in
-- src/lib/coor/handoff.ts (initiate/accept/decline/revoke/expire) and
-- src/lib/coor/handoff-context.ts (the consent-gated reader).
--
-- Pre-acceptance handoffs aged past `expires_at` are flipped to 'expired'
-- by the daily Inngest sweep. Terminal-state rows are kept for audit.

CREATE TYPE "public"."case_handoff_status" AS ENUM (
  'pending_consent',
  'pending_acceptance',
  'accepted',
  'declined',
  'revoked',
  'expired'
);--> statement-breakpoint

CREATE TYPE "public"."case_handoff_scope_kind" AS ENUM (
  'intakes',
  'case_notes',
  'service_events',
  'consents'
);--> statement-breakpoint

CREATE TABLE "case_handoffs" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "synthetic_person_ref" text NOT NULL,
  -- Initiating partner org. ON DELETE RESTRICT — admin must explicitly
  -- terminate any open handoffs before removing an org.
  "from_partner_org_id" uuid NOT NULL,
  -- Receiving partner org.
  "to_partner_org_id" uuid NOT NULL,
  "initiated_by_user_id" uuid NOT NULL,
  "responded_by_user_id" uuid,
  "status" "case_handoff_status" NOT NULL DEFAULT 'pending_consent',
  "purpose" text NOT NULL,
  -- jsonb array of case_handoff_scope_kind values; validated at the
  -- application layer before insert.
  "requested_scope" jsonb NOT NULL,
  -- person_partner_consents row authorising the receiver. ON DELETE SET
  -- NULL so loadHandoffContext fails closed if the consent is purged.
  "consent_id" uuid,
  "decline_reason" text,
  "expires_at" timestamp with time zone NOT NULL,
  "accepted_at" timestamp with time zone,
  "closed_at" timestamp with time zone,
  "created_at" timestamp with time zone NOT NULL DEFAULT now(),
  "updated_at" timestamp with time zone NOT NULL DEFAULT now(),
  CONSTRAINT "case_handoffs_distinct_orgs" CHECK (from_partner_org_id <> to_partner_org_id)
);--> statement-breakpoint

ALTER TABLE "case_handoffs"
  ADD CONSTRAINT "case_handoffs_from_partner_org_id_fk"
  FOREIGN KEY ("from_partner_org_id") REFERENCES "public"."partner_orgs"("id") ON DELETE RESTRICT;--> statement-breakpoint

ALTER TABLE "case_handoffs"
  ADD CONSTRAINT "case_handoffs_to_partner_org_id_fk"
  FOREIGN KEY ("to_partner_org_id") REFERENCES "public"."partner_orgs"("id") ON DELETE RESTRICT;--> statement-breakpoint

ALTER TABLE "case_handoffs"
  ADD CONSTRAINT "case_handoffs_initiated_by_user_id_fk"
  FOREIGN KEY ("initiated_by_user_id") REFERENCES "public"."users"("id") ON DELETE RESTRICT;--> statement-breakpoint

ALTER TABLE "case_handoffs"
  ADD CONSTRAINT "case_handoffs_responded_by_user_id_fk"
  FOREIGN KEY ("responded_by_user_id") REFERENCES "public"."users"("id") ON DELETE SET NULL;--> statement-breakpoint

ALTER TABLE "case_handoffs"
  ADD CONSTRAINT "case_handoffs_consent_id_fk"
  FOREIGN KEY ("consent_id") REFERENCES "public"."person_partner_consents"("id") ON DELETE SET NULL;--> statement-breakpoint

CREATE INDEX "case_handoffs_to_partner_idx" ON "case_handoffs" USING btree ("to_partner_org_id", "status");--> statement-breakpoint
CREATE INDEX "case_handoffs_from_partner_idx" ON "case_handoffs" USING btree ("from_partner_org_id", "status");--> statement-breakpoint
CREATE INDEX "case_handoffs_person_ref_idx" ON "case_handoffs" USING btree ("synthetic_person_ref");--> statement-breakpoint
CREATE INDEX "case_handoffs_status_idx" ON "case_handoffs" USING btree ("status");--> statement-breakpoint
CREATE INDEX "case_handoffs_expires_at_idx" ON "case_handoffs" USING btree ("expires_at");
