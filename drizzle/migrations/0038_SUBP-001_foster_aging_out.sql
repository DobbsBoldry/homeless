-- SUBP-001 — foster aging-out countdown (ADR 0006).
--
-- Two tables: `foster_youth` (synthetic individual records, gated at runtime
-- by the active DCBS DSA) and `foster_aging_out_alerts` (one row per
-- (youth, milestone) — the nightly milestone-scan job is idempotent at the
-- composite UNIQUE level).
--
-- Three new enums: foster_placement_type, foster_youth_status,
-- foster_aging_out_milestone.
--
-- Journal idx 37 (post-COOR-014's idx 36, post-PRVN-003 → wait the
-- journal lists them by idx, this is idx 37).

CREATE TYPE "public"."foster_placement_type" AS ENUM (
  'family_foster',
  'kinship',
  'group_home',
  'residential',
  'independent_living',
  'unknown'
);--> statement-breakpoint

CREATE TYPE "public"."foster_youth_status" AS ENUM (
  'active',
  'aged_out',
  'exited'
);--> statement-breakpoint

CREATE TYPE "public"."foster_aging_out_milestone" AS ENUM (
  'd90',
  'd60',
  'd30',
  'd14',
  'd7',
  'aged_out'
);--> statement-breakpoint

CREATE TABLE "foster_youth" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  -- DCBS partner_org under whose DSA this row was ingested. Runtime gate
  -- in subp/dcbs-gate.ts looks up the active agreement via this FK.
  -- ON DELETE RESTRICT — admin must terminate the DSA explicitly.
  "dcbs_partner_org_id" uuid NOT NULL,
  -- Synthetic DCBS case number; replaced post-BAA / post-integration.
  "dcbs_case_id" text NOT NULL,
  -- Synthetic name fields — synthetic data only until ESUC-002 lifts PHI fence.
  "legal_first_name" text NOT NULL,
  "legal_last_name" text NOT NULL,
  -- Required for the aging-out countdown engine.
  "date_of_birth" date NOT NULL,
  "placement_type" "foster_placement_type" NOT NULL,
  "placement_changes_count" integer NOT NULL DEFAULT 0,
  -- Coalition caseworker assigned to the youth — nullable until paired.
  "assigned_caseworker_user_id" uuid,
  -- Structured supports-in-place payload (see SupportsInPlace type).
  "supports_in_place" jsonb NOT NULL,
  "status" "foster_youth_status" NOT NULL DEFAULT 'active',
  "notes" text,
  "created_at" timestamp with time zone NOT NULL DEFAULT now(),
  "updated_at" timestamp with time zone NOT NULL DEFAULT now()
);--> statement-breakpoint

ALTER TABLE "foster_youth"
  ADD CONSTRAINT "foster_youth_dcbs_partner_org_id_fk"
  FOREIGN KEY ("dcbs_partner_org_id") REFERENCES "public"."partner_orgs"("id") ON DELETE RESTRICT;--> statement-breakpoint

ALTER TABLE "foster_youth"
  ADD CONSTRAINT "foster_youth_assigned_caseworker_user_id_fk"
  FOREIGN KEY ("assigned_caseworker_user_id") REFERENCES "public"."users"("id") ON DELETE SET NULL;--> statement-breakpoint

CREATE INDEX "foster_youth_dcbs_partner_idx" ON "foster_youth" USING btree ("dcbs_partner_org_id");--> statement-breakpoint
CREATE INDEX "foster_youth_assigned_caseworker_idx" ON "foster_youth" USING btree ("assigned_caseworker_user_id");--> statement-breakpoint
CREATE INDEX "foster_youth_status_idx" ON "foster_youth" USING btree ("status");--> statement-breakpoint
CREATE INDEX "foster_youth_dob_idx" ON "foster_youth" USING btree ("date_of_birth");--> statement-breakpoint

CREATE TABLE "foster_aging_out_alerts" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "youth_id" uuid NOT NULL,
  "milestone" "foster_aging_out_milestone" NOT NULL,
  "fired_at" timestamp with time zone NOT NULL DEFAULT now(),
  -- Caseworker who acknowledged; SET NULL on user delete.
  "acknowledged_by_user_id" uuid,
  "acknowledged_at" timestamp with time zone
);--> statement-breakpoint

ALTER TABLE "foster_aging_out_alerts"
  ADD CONSTRAINT "foster_aging_out_alerts_youth_id_fk"
  FOREIGN KEY ("youth_id") REFERENCES "public"."foster_youth"("id") ON DELETE CASCADE;--> statement-breakpoint

ALTER TABLE "foster_aging_out_alerts"
  ADD CONSTRAINT "foster_aging_out_alerts_acknowledged_by_user_id_fk"
  FOREIGN KEY ("acknowledged_by_user_id") REFERENCES "public"."users"("id") ON DELETE SET NULL;--> statement-breakpoint

-- Idempotency: composite UNIQUE prevents duplicate alerts on (youth, milestone).
-- Nightly milestone-scan job replays safely.
CREATE UNIQUE INDEX "foster_aging_out_alerts_youth_milestone_uniq"
  ON "foster_aging_out_alerts" USING btree ("youth_id", "milestone");--> statement-breakpoint

-- Partial index on unacknowledged alerts for the caseworker dashboard's
-- "needs-attention" filter.
CREATE INDEX "foster_aging_out_alerts_unack_idx"
  ON "foster_aging_out_alerts" USING btree ("acknowledged_at")
  WHERE "acknowledged_at" IS NULL;--> statement-breakpoint

CREATE INDEX "foster_aging_out_alerts_fired_idx"
  ON "foster_aging_out_alerts" USING btree ("fired_at" DESC);
