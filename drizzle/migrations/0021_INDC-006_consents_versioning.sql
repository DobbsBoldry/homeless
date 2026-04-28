ALTER TABLE "consents" ADD COLUMN "consent_version" text DEFAULT '2026-04-1' NOT NULL;--> statement-breakpoint
ALTER TABLE "consents" ADD COLUMN "scope_partner_ids" jsonb;--> statement-breakpoint
ALTER TABLE "consents" ADD COLUMN "scope_data_classes" jsonb;--> statement-breakpoint
ALTER TABLE "consents" ADD COLUMN "signature_text" text;--> statement-breakpoint
ALTER TABLE "consents" ADD COLUMN "expires_at" timestamp with time zone;--> statement-breakpoint
CREATE INDEX "consents_expires_at_idx" ON "consents" USING btree ("expires_at");