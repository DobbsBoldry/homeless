CREATE TYPE "public"."eviction_response_packet_status" AS ENUM('draft', 'approved', 'filed', 'rejected');--> statement-breakpoint
CREATE TABLE "eviction_response_packets" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"filing_id" uuid NOT NULL,
	"packet_md" text NOT NULL,
	"prompt_version" text NOT NULL,
	"generated_by_user_id" uuid,
	"status" "eviction_response_packet_status" DEFAULT 'draft' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "eviction_response_packets" ADD CONSTRAINT "eviction_response_packets_filing_id_eviction_filings_id_fk" FOREIGN KEY ("filing_id") REFERENCES "public"."eviction_filings"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "eviction_response_packets" ADD CONSTRAINT "eviction_response_packets_generated_by_user_id_users_id_fk" FOREIGN KEY ("generated_by_user_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "response_packets_filing_version_idx" ON "eviction_response_packets" USING btree ("filing_id","prompt_version");--> statement-breakpoint
CREATE INDEX "response_packets_filing_idx" ON "eviction_response_packets" USING btree ("filing_id");--> statement-breakpoint
CREATE INDEX "response_packets_status_idx" ON "eviction_response_packets" USING btree ("status");