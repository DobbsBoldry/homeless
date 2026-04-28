CREATE TABLE "dv_flagged_persons" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"subject_identifier" text NOT NULL,
	"notes" text,
	"flag_set_at" timestamp with time zone DEFAULT now() NOT NULL,
	"flag_cleared_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "eviction_filings" ADD COLUMN "dv_flag" boolean DEFAULT false NOT NULL;--> statement-breakpoint
CREATE UNIQUE INDEX "dv_flagged_persons_subject_idx" ON "dv_flagged_persons" USING btree ("subject_identifier");--> statement-breakpoint
CREATE INDEX "dv_flagged_persons_set_at_idx" ON "dv_flagged_persons" USING btree ("flag_set_at");