-- SUBP-007 — families w/ children pathway (McKinney-Vento integration).
--
-- Two tables: family_units (one row per household in the pipeline) and
-- family_children (one row per school-age child). entry_signal_id is
-- a soft FK — Postgres polymorphic FKs aren't a thing, and the
-- operational complexity isn't worth it for v1.
--
-- Four new enums: family_unit_status, family_entry_signal,
-- family_housing_status, family_child_grade_band.

CREATE TYPE "public"."family_unit_status" AS ENUM (
  'active',
  'rehoused',
  'exited'
);--> statement-breakpoint

CREATE TYPE "public"."family_entry_signal" AS ENUM (
  'eviction',
  'ed_encounter',
  'school_referral',
  'sms_intake',
  'walk_in'
);--> statement-breakpoint

CREATE TYPE "public"."family_housing_status" AS ENUM (
  'stably_housed',
  'doubled_up',
  'shelter',
  'unsheltered',
  'hotel'
);--> statement-breakpoint

CREATE TYPE "public"."family_child_grade_band" AS ENUM (
  'pre_k',
  'elementary',
  'middle',
  'high',
  'not_enrolled'
);--> statement-breakpoint

CREATE TABLE "family_units" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  -- Synthetic primary caregiver name; pre-BAA synthetic only.
  "primary_caregiver_name" text NOT NULL,
  "household_size" integer NOT NULL,
  "children_count" integer NOT NULL,
  "status" "family_unit_status" NOT NULL DEFAULT 'active',
  "entry_signal" "family_entry_signal" NOT NULL,
  -- Opaque text reference to source row (eviction filing, ED encounter,
  -- school referral, SMS conversation). Soft FK only.
  "entry_signal_id" text,
  "current_housing_status" "family_housing_status" NOT NULL,
  "assigned_caseworker_user_id" uuid,
  -- Receiving school district (when known). FK to partner_orgs.
  "receiving_school_district_id" uuid,
  "notes" text,
  "created_at" timestamp with time zone NOT NULL DEFAULT now(),
  "updated_at" timestamp with time zone NOT NULL DEFAULT now()
);--> statement-breakpoint

ALTER TABLE "family_units"
  ADD CONSTRAINT "family_units_assigned_caseworker_user_id_fk"
  FOREIGN KEY ("assigned_caseworker_user_id") REFERENCES "public"."users"("id") ON DELETE SET NULL;--> statement-breakpoint

ALTER TABLE "family_units"
  ADD CONSTRAINT "family_units_receiving_school_district_id_fk"
  FOREIGN KEY ("receiving_school_district_id") REFERENCES "public"."partner_orgs"("id") ON DELETE SET NULL;--> statement-breakpoint

CREATE INDEX "family_units_status_idx" ON "family_units" USING btree ("status");--> statement-breakpoint
CREATE INDEX "family_units_entry_signal_idx" ON "family_units" USING btree ("entry_signal");--> statement-breakpoint
CREATE INDEX "family_units_assigned_caseworker_idx" ON "family_units" USING btree ("assigned_caseworker_user_id");--> statement-breakpoint
CREATE INDEX "family_units_school_district_idx" ON "family_units" USING btree ("receiving_school_district_id");--> statement-breakpoint

CREATE TABLE "family_children" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "family_unit_id" uuid NOT NULL,
  -- Synthetic child identifier (used in URLs / refs; never the legal name).
  "child_ref" text NOT NULL,
  -- Date of birth — synthetic. Used to infer grade-band and age-of-majority.
  "date_of_birth" date,
  "current_school_id" uuid,
  -- McKinney-Vento identification flag, structured per child.
  "enrolled_in_mckinney_vento" jsonb NOT NULL DEFAULT '{"flagged":false,"flaggedAt":null,"source":null}'::jsonb,
  "grade_band" "family_child_grade_band" NOT NULL,
  "created_at" timestamp with time zone NOT NULL DEFAULT now(),
  "updated_at" timestamp with time zone NOT NULL DEFAULT now()
);--> statement-breakpoint

ALTER TABLE "family_children"
  ADD CONSTRAINT "family_children_family_unit_id_fk"
  FOREIGN KEY ("family_unit_id") REFERENCES "public"."family_units"("id") ON DELETE CASCADE;--> statement-breakpoint

ALTER TABLE "family_children"
  ADD CONSTRAINT "family_children_current_school_id_fk"
  FOREIGN KEY ("current_school_id") REFERENCES "public"."partner_orgs"("id") ON DELETE SET NULL;--> statement-breakpoint

CREATE INDEX "family_children_family_idx" ON "family_children" USING btree ("family_unit_id");--> statement-breakpoint
CREATE INDEX "family_children_school_idx" ON "family_children" USING btree ("current_school_id");--> statement-breakpoint
CREATE INDEX "family_children_grade_idx" ON "family_children" USING btree ("grade_band");
