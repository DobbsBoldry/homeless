-- DTRS-010 — FERPA-compliant partner-agreements registry
-- See ADR 0004 for the design rationale.
--
-- One polymorphic `partner_agreements` table covers all agreement kinds
-- (FERPA, MOU, BAA, QSOA, DSA, memo_of_cooperation). Kind-specific
-- structured terms live in the `terms` JSONB column; the rendered legal
-- text (immutable after signing) lives in `template_rendered`.
--
-- Three indexes:
--   partner_agreements_partner_idx       — list all agreements for a partner
--   partner_agreements_kind_status_idx   — filter by kind + status
--   partner_agreements_active_idx        — partial index: active-only rows
CREATE TYPE "public"."partner_agreement_kind" AS ENUM(
  'mou',
  'ferpa',
  'baa',
  'qsoa',
  'dsa',
  'memo_of_cooperation'
);--> statement-breakpoint

CREATE TYPE "public"."partner_agreement_status" AS ENUM(
  'draft',
  'active',
  'expired',
  'terminated',
  'superseded'
);--> statement-breakpoint

CREATE TABLE "partner_agreements" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "partner_org_id" uuid NOT NULL,
  "kind" "partner_agreement_kind" NOT NULL,
  "status" "partner_agreement_status" DEFAULT 'draft' NOT NULL,
  "effective_date" date,
  "end_date" date,
  "signed_by_partner" text,
  "signed_by_coalition_user_id" uuid,
  "template_version" text,
  "template_rendered" text,
  "terms" jsonb DEFAULT '{}'::jsonb NOT NULL,
  "notes" text,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL,
  "updated_at" timestamp with time zone DEFAULT now() NOT NULL,
  CONSTRAINT "partner_agreements_date_order"
    CHECK (effective_date IS NULL OR end_date IS NULL OR effective_date <= end_date)
);--> statement-breakpoint

ALTER TABLE "partner_agreements"
  ADD CONSTRAINT "partner_agreements_partner_org_id_fk"
  FOREIGN KEY ("partner_org_id") REFERENCES "public"."partner_orgs"("id") ON DELETE RESTRICT;--> statement-breakpoint

ALTER TABLE "partner_agreements"
  ADD CONSTRAINT "partner_agreements_coalition_user_id_fk"
  FOREIGN KEY ("signed_by_coalition_user_id") REFERENCES "public"."users"("id") ON DELETE SET NULL;--> statement-breakpoint

CREATE INDEX "partner_agreements_partner_idx"
  ON "partner_agreements" USING btree ("partner_org_id");--> statement-breakpoint

CREATE INDEX "partner_agreements_kind_status_idx"
  ON "partner_agreements" USING btree ("kind", "status");--> statement-breakpoint

CREATE INDEX "partner_agreements_active_idx"
  ON "partner_agreements" USING btree ("status")
  WHERE status = 'active';
