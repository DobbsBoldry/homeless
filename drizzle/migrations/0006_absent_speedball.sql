CREATE TABLE "eviction_filing_risk_scores" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"filing_id" uuid NOT NULL,
	"score" integer NOT NULL,
	"rationale" text NOT NULL,
	"model_version" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "eviction_filing_risk_scores" ADD CONSTRAINT "eviction_filing_risk_scores_filing_id_eviction_filings_id_fk" FOREIGN KEY ("filing_id") REFERENCES "public"."eviction_filings"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "risk_scores_filing_version_idx" ON "eviction_filing_risk_scores" USING btree ("filing_id","model_version");--> statement-breakpoint
CREATE INDEX "risk_scores_filing_idx" ON "eviction_filing_risk_scores" USING btree ("filing_id");--> statement-breakpoint
CREATE INDEX "risk_scores_score_idx" ON "eviction_filing_risk_scores" USING btree ("score");