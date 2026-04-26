CREATE TABLE "rental_assistance_programs" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"name" text NOT NULL,
	"agency" text NOT NULL,
	"phone" text,
	"website" text,
	"eligibility_summary" text NOT NULL,
	"max_award_cents" integer,
	"source_note" text,
	"active" boolean DEFAULT true NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE INDEX "rental_assistance_programs_active_idx" ON "rental_assistance_programs" USING btree ("active");