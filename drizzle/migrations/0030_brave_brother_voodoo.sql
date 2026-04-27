CREATE TABLE "client_case_notes" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"synthetic_person_ref" text NOT NULL,
	"body_md" text NOT NULL,
	"drafted_by_ai" boolean DEFAULT false NOT NULL,
	"ai_model_id" text,
	"ai_prompt_version" text,
	"parent_note_id" uuid,
	"created_by_user_id" uuid NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "client_case_notes" ADD CONSTRAINT "client_case_notes_parent_note_id_client_case_notes_id_fk" FOREIGN KEY ("parent_note_id") REFERENCES "public"."client_case_notes"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "client_case_notes" ADD CONSTRAINT "client_case_notes_created_by_user_id_users_id_fk" FOREIGN KEY ("created_by_user_id") REFERENCES "public"."users"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "client_case_notes_synthetic_ref_idx" ON "client_case_notes" USING btree ("synthetic_person_ref");--> statement-breakpoint
CREATE INDEX "client_case_notes_parent_idx" ON "client_case_notes" USING btree ("parent_note_id");--> statement-breakpoint
CREATE INDEX "client_case_notes_created_by_idx" ON "client_case_notes" USING btree ("created_by_user_id");