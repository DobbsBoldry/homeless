CREATE TABLE "comms_advisories" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"title" text NOT NULL,
	"body_md" text NOT NULL,
	"spokesperson_name" text NOT NULL,
	"spokesperson_contact" text,
	"active" boolean DEFAULT true NOT NULL,
	"posted_by_user_id" uuid NOT NULL,
	"ended_at" timestamp with time zone,
	"ended_by_user_id" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "comms_advisories" ADD CONSTRAINT "comms_advisories_posted_by_user_id_users_id_fk" FOREIGN KEY ("posted_by_user_id") REFERENCES "public"."users"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "comms_advisories" ADD CONSTRAINT "comms_advisories_ended_by_user_id_users_id_fk" FOREIGN KEY ("ended_by_user_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "comms_advisories_active_idx" ON "comms_advisories" USING btree ("active");--> statement-breakpoint
CREATE INDEX "comms_advisories_created_idx" ON "comms_advisories" USING btree ("created_at");