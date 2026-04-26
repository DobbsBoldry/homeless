CREATE TYPE "public"."triage_tier" AS ENUM('high', 'medium', 'low');--> statement-breakpoint
CREATE TABLE "triage_overrides" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"actor_user_id" uuid NOT NULL,
	"recommended_tier" "triage_tier" NOT NULL,
	"recommended_score" integer NOT NULL,
	"chosen_tier" "triage_tier" NOT NULL,
	"override_reason" text,
	"inputs_snapshot" jsonb NOT NULL,
	"recommended_factors" jsonb NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "triage_overrides" ADD CONSTRAINT "triage_overrides_actor_user_id_users_id_fk" FOREIGN KEY ("actor_user_id") REFERENCES "public"."users"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "triage_overrides_actor_idx" ON "triage_overrides" USING btree ("actor_user_id");--> statement-breakpoint
CREATE INDEX "triage_overrides_created_idx" ON "triage_overrides" USING btree ("created_at");--> statement-breakpoint
CREATE INDEX "triage_overrides_recommended_idx" ON "triage_overrides" USING btree ("recommended_tier");