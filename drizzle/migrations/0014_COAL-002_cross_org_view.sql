CREATE TYPE "public"."partner_service_event_type" AS ENUM('food_pantry', 'shelter_intake', 'shelter_bed_night', 'utility_assistance', 'rent_assistance', 'counseling_visit', 'medical_visit', 'school_attendance_flag', 'volunteer_hours', 'other');--> statement-breakpoint
CREATE TABLE "partner_service_events" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"partner_org_id" uuid NOT NULL,
	"synthetic_person_ref" text NOT NULL,
	"event_type" "partner_service_event_type" NOT NULL,
	"event_at" timestamp with time zone NOT NULL,
	"notes" text,
	"source" "ed_encounter_source" DEFAULT 'synthetic' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "partner_service_events" ADD CONSTRAINT "partner_service_events_partner_org_id_partner_orgs_id_fk" FOREIGN KEY ("partner_org_id") REFERENCES "public"."partner_orgs"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "partner_service_events_person_idx" ON "partner_service_events" USING btree ("synthetic_person_ref");--> statement-breakpoint
CREATE INDEX "partner_service_events_partner_idx" ON "partner_service_events" USING btree ("partner_org_id");--> statement-breakpoint
CREATE INDEX "partner_service_events_at_idx" ON "partner_service_events" USING btree ("event_at");