CREATE TYPE "public"."ed_encounter_source" AS ENUM('synthetic', 'epic_fhir', 'manual');--> statement-breakpoint
CREATE TYPE "public"."housing_status" AS ENUM('housed', 'doubled_up', 'shelter', 'unsheltered', 'unknown');--> statement-breakpoint
CREATE TABLE "ed_encounters" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"patient_id" text NOT NULL,
	"encounter_external_id" text NOT NULL,
	"arrived_at" timestamp with time zone NOT NULL,
	"discharged_at" timestamp with time zone,
	"chief_complaint" text NOT NULL,
	"disposition" text NOT NULL,
	"housing_status" "housing_status" DEFAULT 'unknown' NOT NULL,
	"charge_cents" integer,
	"notes" text,
	"raw_json" jsonb,
	"source" "ed_encounter_source" DEFAULT 'synthetic' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX "ed_encounters_external_idx" ON "ed_encounters" USING btree ("encounter_external_id","source");--> statement-breakpoint
CREATE INDEX "ed_encounters_patient_idx" ON "ed_encounters" USING btree ("patient_id");--> statement-breakpoint
CREATE INDEX "ed_encounters_arrived_idx" ON "ed_encounters" USING btree ("arrived_at");--> statement-breakpoint
CREATE INDEX "ed_encounters_housing_idx" ON "ed_encounters" USING btree ("housing_status");