CREATE TYPE "public"."fag_feedback_category" AS ENUM('service_gap', 'tool_issue', 'process_suggestion', 'other');--> statement-breakpoint
CREATE TABLE "fag_feedback" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"fag_member_id" uuid NOT NULL,
	"user_id" uuid NOT NULL,
	"route" text NOT NULL,
	"rating" integer NOT NULL,
	"comment" text,
	"category" "fag_feedback_category" NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "fag_members" ADD COLUMN "user_id" uuid;--> statement-breakpoint
ALTER TABLE "fag_feedback" ADD CONSTRAINT "fag_feedback_fag_member_id_fag_members_id_fk" FOREIGN KEY ("fag_member_id") REFERENCES "public"."fag_members"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "fag_feedback" ADD CONSTRAINT "fag_feedback_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "fag_feedback_member_idx" ON "fag_feedback" USING btree ("fag_member_id");--> statement-breakpoint
CREATE INDEX "fag_feedback_user_idx" ON "fag_feedback" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "fag_feedback_created_idx" ON "fag_feedback" USING btree ("created_at");--> statement-breakpoint
ALTER TABLE "fag_members" ADD CONSTRAINT "fag_members_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "fag_members_user_id_idx" ON "fag_members" USING btree ("user_id");