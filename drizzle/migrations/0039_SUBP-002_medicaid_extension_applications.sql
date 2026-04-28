-- SUBP-002 — TEAMKY Former Foster Youth Medicaid extension applications.
--
-- One row per youth + attempt. Status flow enforced at the query layer:
--   drafted → submitted → approved | denied
--   any → withdrawn
--
-- 42 U.S.C. § 1396a(a)(10)(A)(i)(IX) extends Medicaid eligibility to
-- former foster youth up to age 26.

CREATE TYPE "public"."medicaid_extension_status" AS ENUM (
  'drafted',
  'submitted',
  'approved',
  'denied',
  'withdrawn'
);--> statement-breakpoint

CREATE TABLE "medicaid_extension_applications" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "youth_id" uuid NOT NULL,
  "status" "medicaid_extension_status" NOT NULL DEFAULT 'drafted',
  -- Synthetic kynect reference until the kynect integration lands.
  "kynect_reference" text,
  "application_payload" jsonb NOT NULL,
  "drafted_by_user_id" uuid NOT NULL,
  "drafted_at" timestamp with time zone NOT NULL DEFAULT now(),
  "submitted_at" timestamp with time zone,
  "decision_at" timestamp with time zone,
  "decision_reason" text,
  "withdrawn_at" timestamp with time zone,
  "created_at" timestamp with time zone NOT NULL DEFAULT now(),
  "updated_at" timestamp with time zone NOT NULL DEFAULT now()
);--> statement-breakpoint

ALTER TABLE "medicaid_extension_applications"
  ADD CONSTRAINT "medicaid_extension_applications_youth_id_fk"
  FOREIGN KEY ("youth_id") REFERENCES "public"."foster_youth"("id") ON DELETE CASCADE;--> statement-breakpoint

ALTER TABLE "medicaid_extension_applications"
  ADD CONSTRAINT "medicaid_extension_applications_drafted_by_user_id_fk"
  FOREIGN KEY ("drafted_by_user_id") REFERENCES "public"."users"("id") ON DELETE RESTRICT;--> statement-breakpoint

CREATE INDEX "medicaid_extension_applications_youth_idx"
  ON "medicaid_extension_applications" USING btree ("youth_id");--> statement-breakpoint

CREATE INDEX "medicaid_extension_applications_status_idx"
  ON "medicaid_extension_applications" USING btree ("status");--> statement-breakpoint

CREATE INDEX "medicaid_extension_applications_drafted_at_idx"
  ON "medicaid_extension_applications" USING btree ("drafted_at" DESC);
