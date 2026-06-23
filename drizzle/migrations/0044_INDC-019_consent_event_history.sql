CREATE TYPE "public"."person_partner_consent_event_type" AS ENUM('granted', 'revoked');--> statement-breakpoint
CREATE TABLE "person_partner_consent_events" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"consent_id" uuid NOT NULL,
	"event_type" "person_partner_consent_event_type" NOT NULL,
	"event_at" timestamp with time zone DEFAULT now() NOT NULL,
	"actor_user_id" uuid,
	"notes" text
);
--> statement-breakpoint
ALTER TABLE "person_partner_consent_events" ADD CONSTRAINT "person_partner_consent_events_consent_id_person_partner_consents_id_fk" FOREIGN KEY ("consent_id") REFERENCES "public"."person_partner_consents"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "person_partner_consent_events" ADD CONSTRAINT "person_partner_consent_events_actor_user_id_users_id_fk" FOREIGN KEY ("actor_user_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "person_partner_consent_events_consent_idx" ON "person_partner_consent_events" USING btree ("consent_id");
