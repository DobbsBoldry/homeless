-- DTRS-007 — faith-friendly aggregate-only data schema
-- See ADR 0003 for the privacy contract.
--
-- Four tables:
--   faith_ministries                 — opted-in ministries (Catholic Charities umbrella + parishes)
--   faith_aggregate_submissions      — one row per (ministry, period)
--   faith_aggregate_metrics          — counts per metric_key (NULL when suppressed)
--   faith_aggregate_breakouts        — demographic breakouts (NULL when suppressed)
--
-- Cell-size suppression is enforced at the application layer (see
-- src/lib/dtrs/faith-aggregate.ts); the DB just expresses the contract
-- via CHECK constraints: value-or-suppressed is exclusive, suppressed-NULL
-- is well-formed, and counts can never be negative.
CREATE TYPE "public"."faith_ministry_status" AS ENUM('opted_in', 'paused', 'opted_out');--> statement-breakpoint
CREATE TYPE "public"."faith_aggregate_period_kind" AS ENUM('week', 'month', 'quarter');--> statement-breakpoint

CREATE TABLE "faith_ministries" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"partner_org_id" uuid,
	"name" text NOT NULL,
	"umbrella_ministry_id" uuid,
	"contact_name" text,
	"contact_email" text,
	"contact_phone" text,
	"status" "faith_ministry_status" DEFAULT 'opted_in' NOT NULL,
	"min_cell_size" integer DEFAULT 10 NOT NULL,
	"opted_in_at" timestamp with time zone DEFAULT now() NOT NULL,
	"opted_out_at" timestamp with time zone,
	"notes" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint

ALTER TABLE "faith_ministries"
  ADD CONSTRAINT "faith_ministries_partner_org_id_fk"
  FOREIGN KEY ("partner_org_id") REFERENCES "public"."partner_orgs"("id") ON DELETE SET NULL;
--> statement-breakpoint

ALTER TABLE "faith_ministries"
  ADD CONSTRAINT "faith_ministries_umbrella_ministry_id_fk"
  FOREIGN KEY ("umbrella_ministry_id") REFERENCES "public"."faith_ministries"("id") ON DELETE SET NULL;
--> statement-breakpoint

CREATE UNIQUE INDEX "faith_ministries_name_idx" ON "faith_ministries" USING btree ("name");--> statement-breakpoint
CREATE INDEX "faith_ministries_umbrella_idx" ON "faith_ministries" USING btree ("umbrella_ministry_id");--> statement-breakpoint
CREATE INDEX "faith_ministries_status_idx" ON "faith_ministries" USING btree ("status");--> statement-breakpoint

CREATE TABLE "faith_aggregate_submissions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"ministry_id" uuid NOT NULL,
	"period_kind" "faith_aggregate_period_kind" NOT NULL,
	"period_start" date NOT NULL,
	"period_end" date NOT NULL,
	"submitted_by_user_id" uuid,
	"submitted_at" timestamp with time zone DEFAULT now() NOT NULL,
	"notes" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "faith_aggregate_submissions_period_order" CHECK (period_start <= period_end)
);
--> statement-breakpoint

ALTER TABLE "faith_aggregate_submissions"
  ADD CONSTRAINT "faith_aggregate_submissions_ministry_id_fk"
  FOREIGN KEY ("ministry_id") REFERENCES "public"."faith_ministries"("id") ON DELETE CASCADE;
--> statement-breakpoint

ALTER TABLE "faith_aggregate_submissions"
  ADD CONSTRAINT "faith_aggregate_submissions_user_id_fk"
  FOREIGN KEY ("submitted_by_user_id") REFERENCES "public"."users"("id") ON DELETE SET NULL;
--> statement-breakpoint

CREATE UNIQUE INDEX "faith_aggregate_submissions_period_idx"
  ON "faith_aggregate_submissions" USING btree ("ministry_id", "period_start", "period_end");--> statement-breakpoint
CREATE INDEX "faith_aggregate_submissions_ministry_idx"
  ON "faith_aggregate_submissions" USING btree ("ministry_id");--> statement-breakpoint
CREATE INDEX "faith_aggregate_submissions_period_start_idx"
  ON "faith_aggregate_submissions" USING btree ("period_start");--> statement-breakpoint

CREATE TABLE "faith_aggregate_metrics" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"submission_id" uuid NOT NULL,
	"metric_key" text NOT NULL,
	"value" integer,
	"suppressed" boolean DEFAULT false NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "faith_aggregate_metrics_value_or_suppressed"
	  CHECK ((value IS NOT NULL AND suppressed = false) OR (value IS NULL AND suppressed = true)),
	CONSTRAINT "faith_aggregate_metrics_value_nonneg"
	  CHECK (value IS NULL OR value >= 0)
);
--> statement-breakpoint

ALTER TABLE "faith_aggregate_metrics"
  ADD CONSTRAINT "faith_aggregate_metrics_submission_id_fk"
  FOREIGN KEY ("submission_id") REFERENCES "public"."faith_aggregate_submissions"("id") ON DELETE CASCADE;
--> statement-breakpoint

CREATE UNIQUE INDEX "faith_aggregate_metrics_key_idx"
  ON "faith_aggregate_metrics" USING btree ("submission_id", "metric_key");--> statement-breakpoint

CREATE TABLE "faith_aggregate_breakouts" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"submission_id" uuid NOT NULL,
	"dimension" text NOT NULL,
	"bucket" text NOT NULL,
	"count" integer,
	"suppressed" boolean DEFAULT false NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "faith_aggregate_breakouts_count_or_suppressed"
	  CHECK ((count IS NOT NULL AND suppressed = false) OR (count IS NULL AND suppressed = true)),
	CONSTRAINT "faith_aggregate_breakouts_count_nonneg"
	  CHECK (count IS NULL OR count >= 0)
);
--> statement-breakpoint

ALTER TABLE "faith_aggregate_breakouts"
  ADD CONSTRAINT "faith_aggregate_breakouts_submission_id_fk"
  FOREIGN KEY ("submission_id") REFERENCES "public"."faith_aggregate_submissions"("id") ON DELETE CASCADE;
--> statement-breakpoint

CREATE UNIQUE INDEX "faith_aggregate_breakouts_dim_idx"
  ON "faith_aggregate_breakouts" USING btree ("submission_id", "dimension", "bucket");
