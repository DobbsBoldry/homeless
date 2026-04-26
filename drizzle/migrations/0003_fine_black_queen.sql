CREATE TYPE "public"."eviction_cause_type" AS ENUM('non_payment', 'lease_violation', 'holdover', 'other');--> statement-breakpoint
CREATE TYPE "public"."eviction_filing_source" AS ENUM('courtnet', 'manual', 'synthetic');--> statement-breakpoint
CREATE TYPE "public"."eviction_filing_status" AS ENUM('filed', 'served', 'judgment', 'dismissed', 'sealed');--> statement-breakpoint
CREATE TABLE "eviction_filings" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"case_number" text NOT NULL,
	"filed_at" timestamp with time zone NOT NULL,
	"court_division" text,
	"plaintiff" text NOT NULL,
	"defendant_first_name" text NOT NULL,
	"defendant_last_name" text NOT NULL,
	"defendant_address" text,
	"cause_type" "eviction_cause_type" NOT NULL,
	"amount_claimed_cents" integer,
	"status" "eviction_filing_status" DEFAULT 'filed' NOT NULL,
	"source" "eviction_filing_source" NOT NULL,
	"raw_json" jsonb,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX "eviction_filings_case_source_idx" ON "eviction_filings" USING btree ("case_number","source");--> statement-breakpoint
CREATE INDEX "eviction_filings_filed_at_idx" ON "eviction_filings" USING btree ("filed_at");--> statement-breakpoint
CREATE INDEX "eviction_filings_status_idx" ON "eviction_filings" USING btree ("status");