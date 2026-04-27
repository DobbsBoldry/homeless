CREATE TABLE "steering_meetings" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"title" text NOT NULL,
	"held_on" date NOT NULL,
	"attendees" jsonb NOT NULL,
	"agenda_md" text DEFAULT '' NOT NULL,
	"decisions_md" text DEFAULT '' NOT NULL,
	"action_items_md" text DEFAULT '' NOT NULL,
	"posted_at" timestamp with time zone,
	"created_by_user_id" uuid NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "steering_meetings" ADD CONSTRAINT "steering_meetings_created_by_user_id_users_id_fk" FOREIGN KEY ("created_by_user_id") REFERENCES "public"."users"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "steering_meetings_held_on_idx" ON "steering_meetings" USING btree ("held_on");--> statement-breakpoint
CREATE INDEX "steering_meetings_created_by_idx" ON "steering_meetings" USING btree ("created_by_user_id");