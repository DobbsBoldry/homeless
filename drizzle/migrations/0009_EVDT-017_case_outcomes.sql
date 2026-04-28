CREATE TYPE "public"."eviction_case_outcome" AS ENUM('dismissed', 'judgment_for_plaintiff', 'judgment_for_defendant', 'settled', 'default_judgment', 'withdrawn');--> statement-breakpoint
CREATE TABLE "eviction_case_outcomes" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"filing_id" uuid NOT NULL,
	"outcome" "eviction_case_outcome" NOT NULL,
	"notes" text,
	"recorded_by_user_id" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "eviction_case_outcomes" ADD CONSTRAINT "eviction_case_outcomes_filing_id_eviction_filings_id_fk" FOREIGN KEY ("filing_id") REFERENCES "public"."eviction_filings"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "eviction_case_outcomes" ADD CONSTRAINT "eviction_case_outcomes_recorded_by_user_id_users_id_fk" FOREIGN KEY ("recorded_by_user_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "case_outcomes_filing_idx" ON "eviction_case_outcomes" USING btree ("filing_id");--> statement-breakpoint
CREATE INDEX "case_outcomes_outcome_idx" ON "eviction_case_outcomes" USING btree ("outcome");--> statement-breakpoint
CREATE INDEX "case_outcomes_created_at_idx" ON "eviction_case_outcomes" USING btree ("created_at");