CREATE TYPE "public"."esuc_care_plan_status" AS ENUM('draft', 'approved', 'active', 'archived');--> statement-breakpoint
CREATE TABLE "esuc_care_plans" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"patient_id" text NOT NULL,
	"plan_md" text NOT NULL,
	"prompt_version" text NOT NULL,
	"generated_by_user_id" uuid,
	"status" "esuc_care_plan_status" DEFAULT 'draft' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "esuc_care_plans" ADD CONSTRAINT "esuc_care_plans_generated_by_user_id_users_id_fk" FOREIGN KEY ("generated_by_user_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "care_plans_patient_version_idx" ON "esuc_care_plans" USING btree ("patient_id","prompt_version");--> statement-breakpoint
CREATE INDEX "care_plans_patient_idx" ON "esuc_care_plans" USING btree ("patient_id");--> statement-breakpoint
CREATE INDEX "care_plans_status_idx" ON "esuc_care_plans" USING btree ("status");