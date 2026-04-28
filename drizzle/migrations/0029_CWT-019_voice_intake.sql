CREATE TYPE "public"."client_intake_status" AS ENUM('recording', 'transcribed', 'extracting', 'extracted', 'failed');--> statement-breakpoint
CREATE TABLE "client_intakes" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"synthetic_person_ref" text,
	"label" text NOT NULL,
	"transcript_md" text NOT NULL,
	"audio_duration_sec" integer,
	"extracted_profile" jsonb,
	"extraction_notes" text,
	"extraction_model" text,
	"status" "client_intake_status" DEFAULT 'recording' NOT NULL,
	"recorded_by_user_id" uuid NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "client_intakes" ADD CONSTRAINT "client_intakes_recorded_by_user_id_users_id_fk" FOREIGN KEY ("recorded_by_user_id") REFERENCES "public"."users"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "client_intakes_status_idx" ON "client_intakes" USING btree ("status");--> statement-breakpoint
CREATE INDEX "client_intakes_recorded_by_idx" ON "client_intakes" USING btree ("recorded_by_user_id");--> statement-breakpoint
CREATE INDEX "client_intakes_synthetic_ref_idx" ON "client_intakes" USING btree ("synthetic_person_ref");