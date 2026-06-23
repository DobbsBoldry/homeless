ALTER TYPE "public"."veteran_voucher_application_status" ADD VALUE 'pending' BEFORE 'withdrawn';--> statement-breakpoint
ALTER TYPE "public"."veteran_voucher_application_status" ADD VALUE 'approved' BEFORE 'withdrawn';--> statement-breakpoint
ALTER TYPE "public"."veteran_voucher_application_status" ADD VALUE 'housed' BEFORE 'withdrawn';--> statement-breakpoint
CREATE TABLE "vfw_referrals" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"veteran_id" uuid NOT NULL,
	"triggered_by_user_id" uuid,
	"recipient" text NOT NULL,
	"packet" jsonb NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "vfw_referrals" ADD CONSTRAINT "vfw_referrals_veteran_id_veterans_id_fk" FOREIGN KEY ("veteran_id") REFERENCES "public"."veterans"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "vfw_referrals" ADD CONSTRAINT "vfw_referrals_triggered_by_user_id_users_id_fk" FOREIGN KEY ("triggered_by_user_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "vfw_referrals_veteran_idx" ON "vfw_referrals" USING btree ("veteran_id");--> statement-breakpoint
CREATE INDEX "vfw_referrals_created_idx" ON "vfw_referrals" USING btree ("created_at");