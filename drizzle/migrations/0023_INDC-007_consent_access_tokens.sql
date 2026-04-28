CREATE TABLE "consent_access_tokens" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"token" text NOT NULL,
	"synthetic_person_ref" text NOT NULL,
	"issued_by_user_id" uuid NOT NULL,
	"expires_at" timestamp with time zone NOT NULL,
	"used_at" timestamp with time zone,
	"revoked_at" timestamp with time zone,
	"notes" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "consent_access_tokens" ADD CONSTRAINT "consent_access_tokens_issued_by_user_id_users_id_fk" FOREIGN KEY ("issued_by_user_id") REFERENCES "public"."users"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "consent_access_tokens_token_idx" ON "consent_access_tokens" USING btree ("token");--> statement-breakpoint
CREATE INDEX "consent_access_tokens_ref_idx" ON "consent_access_tokens" USING btree ("synthetic_person_ref");--> statement-breakpoint
CREATE INDEX "consent_access_tokens_expires_idx" ON "consent_access_tokens" USING btree ("expires_at");