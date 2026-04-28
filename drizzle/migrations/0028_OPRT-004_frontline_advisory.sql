CREATE TYPE "public"."fag_member_status" AS ENUM('active', 'paused', 'ended');--> statement-breakpoint
CREATE TYPE "public"."fag_payout_status" AS ENUM('unpaid', 'paid', 'voided');--> statement-breakpoint
CREATE TABLE "fag_compensation_entries" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"member_id" uuid NOT NULL,
	"occurred_on" date NOT NULL,
	"description" text NOT NULL,
	"hours_tenths" integer NOT NULL,
	"hourly_rate_cents" integer NOT NULL,
	"total_cents" integer NOT NULL,
	"status" "fag_payout_status" DEFAULT 'unpaid' NOT NULL,
	"paid_at" timestamp with time zone,
	"paid_by_user_id" uuid,
	"notes" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "fag_members" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"full_name" text NOT NULL,
	"role" text NOT NULL,
	"contact_phone" text,
	"contact_email" text,
	"hourly_rate_cents" integer DEFAULT 10000 NOT NULL,
	"status" "fag_member_status" DEFAULT 'active' NOT NULL,
	"notes" text,
	"onboarded_on" date,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "fag_compensation_entries" ADD CONSTRAINT "fag_compensation_entries_member_id_fag_members_id_fk" FOREIGN KEY ("member_id") REFERENCES "public"."fag_members"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "fag_compensation_entries" ADD CONSTRAINT "fag_compensation_entries_paid_by_user_id_users_id_fk" FOREIGN KEY ("paid_by_user_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "fag_compensation_member_idx" ON "fag_compensation_entries" USING btree ("member_id");--> statement-breakpoint
CREATE INDEX "fag_compensation_status_idx" ON "fag_compensation_entries" USING btree ("status");--> statement-breakpoint
CREATE INDEX "fag_compensation_occurred_idx" ON "fag_compensation_entries" USING btree ("occurred_on");--> statement-breakpoint
CREATE INDEX "fag_members_status_idx" ON "fag_members" USING btree ("status");