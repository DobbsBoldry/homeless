CREATE TABLE "person_partner_consents" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"synthetic_person_ref" text NOT NULL,
	"partner_org_id" uuid NOT NULL,
	"granted_at" timestamp with time zone DEFAULT now() NOT NULL,
	"revoked_at" timestamp with time zone,
	"notes" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "person_partner_consents" ADD CONSTRAINT "person_partner_consents_partner_org_id_partner_orgs_id_fk" FOREIGN KEY ("partner_org_id") REFERENCES "public"."partner_orgs"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "person_partner_consents_unique_idx" ON "person_partner_consents" USING btree ("synthetic_person_ref","partner_org_id");