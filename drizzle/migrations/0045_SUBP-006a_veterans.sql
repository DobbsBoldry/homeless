CREATE TYPE "public"."veteran_eligibility_source" AS ENUM('va_confirmed', 'self_reported');--> statement-breakpoint
CREATE TYPE "public"."veteran_status" AS ENUM('active', 'exited');--> statement-breakpoint
CREATE TABLE "veterans" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"synthetic_person_ref" text NOT NULL,
	"legal_first_name" text NOT NULL,
	"legal_last_name" text NOT NULL,
	"branch_of_service" text,
	"eligibility_source" "veteran_eligibility_source" NOT NULL,
	"caseworker_verified" boolean DEFAULT false NOT NULL,
	"assigned_caseworker_user_id" uuid,
	"status" "veteran_status" DEFAULT 'active' NOT NULL,
	"notes" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "veterans" ADD CONSTRAINT "veterans_assigned_caseworker_user_id_users_id_fk" FOREIGN KEY ("assigned_caseworker_user_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "veterans_caseworker_idx" ON "veterans" USING btree ("assigned_caseworker_user_id");--> statement-breakpoint
CREATE INDEX "veterans_status_idx" ON "veterans" USING btree ("status");--> statement-breakpoint
CREATE INDEX "veterans_synthetic_ref_idx" ON "veterans" USING btree ("synthetic_person_ref");