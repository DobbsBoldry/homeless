CREATE TYPE "public"."bed_hold_status" AS ENUM('active', 'released', 'expired', 'converted');--> statement-breakpoint
CREATE TABLE "bed_holds" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"shelter_id" uuid NOT NULL,
	"held_by_user_id" uuid NOT NULL,
	"person_label" text NOT NULL,
	"status" "bed_hold_status" DEFAULT 'active' NOT NULL,
	"expires_at" timestamp with time zone NOT NULL,
	"released_at" timestamp with time zone,
	"notes" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "bed_holds" ADD CONSTRAINT "bed_holds_shelter_id_shelters_id_fk" FOREIGN KEY ("shelter_id") REFERENCES "public"."shelters"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "bed_holds_shelter_idx" ON "bed_holds" USING btree ("shelter_id");--> statement-breakpoint
CREATE INDEX "bed_holds_status_idx" ON "bed_holds" USING btree ("status");--> statement-breakpoint
CREATE INDEX "bed_holds_expires_idx" ON "bed_holds" USING btree ("expires_at");