CREATE TABLE "bed_count_updates" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"shelter_id" uuid NOT NULL,
	"updated_by_user_id" text NOT NULL,
	"previous_occupancy" integer NOT NULL,
	"new_occupancy" integer NOT NULL,
	"note" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "shelters" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"partner_org_id" uuid NOT NULL,
	"name" text NOT NULL,
	"slug" text NOT NULL,
	"address_line1" text,
	"city" text,
	"state" text,
	"postal_code" text,
	"contact_phone" text,
	"capacity" integer NOT NULL,
	"current_occupancy" integer DEFAULT 0 NOT NULL,
	"accepts_men" boolean DEFAULT false NOT NULL,
	"accepts_women" boolean DEFAULT false NOT NULL,
	"accepts_families" boolean DEFAULT false NOT NULL,
	"pet_friendly" boolean DEFAULT false NOT NULL,
	"sud_friendly" boolean DEFAULT false NOT NULL,
	"active" boolean DEFAULT true NOT NULL,
	"notes" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "shelters_capacity_nonneg" CHECK ("shelters"."capacity" >= 0),
	CONSTRAINT "shelters_occupancy_nonneg" CHECK ("shelters"."current_occupancy" >= 0),
	CONSTRAINT "shelters_occupancy_le_capacity" CHECK ("shelters"."current_occupancy" <= "shelters"."capacity")
);
--> statement-breakpoint
ALTER TABLE "bed_count_updates" ADD CONSTRAINT "bed_count_updates_shelter_id_shelters_id_fk" FOREIGN KEY ("shelter_id") REFERENCES "public"."shelters"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "shelters" ADD CONSTRAINT "shelters_partner_org_id_partner_orgs_id_fk" FOREIGN KEY ("partner_org_id") REFERENCES "public"."partner_orgs"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "bed_count_updates_shelter_idx" ON "bed_count_updates" USING btree ("shelter_id");--> statement-breakpoint
CREATE INDEX "bed_count_updates_created_idx" ON "bed_count_updates" USING btree ("created_at");--> statement-breakpoint
CREATE UNIQUE INDEX "shelters_slug_idx" ON "shelters" USING btree ("slug");--> statement-breakpoint
CREATE INDEX "shelters_partner_org_idx" ON "shelters" USING btree ("partner_org_id");