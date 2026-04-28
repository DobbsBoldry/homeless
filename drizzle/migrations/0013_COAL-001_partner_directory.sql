CREATE TYPE "public"."data_sharing_tier" AS ENUM('none', 'aggregate', 'individual');--> statement-breakpoint
ALTER TYPE "public"."partner_org_type" ADD VALUE 'faith_based' BEFORE 'other';--> statement-breakpoint
ALTER TYPE "public"."partner_org_type" ADD VALUE 'school' BEFORE 'other';--> statement-breakpoint
ALTER TYPE "public"."partner_org_type" ADD VALUE 'philanthropy' BEFORE 'other';--> statement-breakpoint
ALTER TYPE "public"."partner_org_type" ADD VALUE 'education' BEFORE 'other';--> statement-breakpoint
ALTER TYPE "public"."partner_org_type" ADD VALUE 'public_health' BEFORE 'other';--> statement-breakpoint
ALTER TYPE "public"."partner_org_type" ADD VALUE 'media' BEFORE 'other';--> statement-breakpoint
ALTER TABLE "partner_orgs" ADD COLUMN "website" text;--> statement-breakpoint
ALTER TABLE "partner_orgs" ADD COLUMN "description" text;--> statement-breakpoint
ALTER TABLE "partner_orgs" ADD COLUMN "data_sharing_tier" "data_sharing_tier" DEFAULT 'none' NOT NULL;