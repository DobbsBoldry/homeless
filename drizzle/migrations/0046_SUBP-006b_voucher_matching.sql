CREATE TYPE "public"."hud_vash_voucher_status" AS ENUM('available', 'pending', 'leased');--> statement-breakpoint
CREATE TYPE "public"."veteran_voucher_application_status" AS ENUM('applied', 'withdrawn');--> statement-breakpoint
CREATE TABLE "hud_vash_vouchers" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"voucher_code" text NOT NULL,
	"unit_type" text NOT NULL,
	"bedrooms" integer NOT NULL,
	"location" text NOT NULL,
	"zip" text,
	"accessible" boolean DEFAULT false NOT NULL,
	"availability_status" "hud_vash_voucher_status" DEFAULT 'available' NOT NULL,
	"notes" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "veteran_voucher_applications" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"veteran_id" uuid NOT NULL,
	"voucher_id" uuid NOT NULL,
	"status" "veteran_voucher_application_status" DEFAULT 'applied' NOT NULL,
	"applied_by_user_id" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "veterans" ADD COLUMN "bedroom_need" integer;--> statement-breakpoint
ALTER TABLE "veterans" ADD COLUMN "accessibility_need" boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE "veterans" ADD COLUMN "target_zip" text;--> statement-breakpoint
ALTER TABLE "veteran_voucher_applications" ADD CONSTRAINT "veteran_voucher_applications_veteran_id_veterans_id_fk" FOREIGN KEY ("veteran_id") REFERENCES "public"."veterans"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "veteran_voucher_applications" ADD CONSTRAINT "veteran_voucher_applications_voucher_id_hud_vash_vouchers_id_fk" FOREIGN KEY ("voucher_id") REFERENCES "public"."hud_vash_vouchers"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "veteran_voucher_applications" ADD CONSTRAINT "veteran_voucher_applications_applied_by_user_id_users_id_fk" FOREIGN KEY ("applied_by_user_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "hud_vash_vouchers_status_idx" ON "hud_vash_vouchers" USING btree ("availability_status");--> statement-breakpoint
CREATE UNIQUE INDEX "veteran_voucher_applications_unique_idx" ON "veteran_voucher_applications" USING btree ("veteran_id","voucher_id");--> statement-breakpoint
CREATE INDEX "veteran_voucher_applications_veteran_idx" ON "veteran_voucher_applications" USING btree ("veteran_id");