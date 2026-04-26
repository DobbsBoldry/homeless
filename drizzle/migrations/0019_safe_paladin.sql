CREATE TYPE "public"."sms_conversation_state" AS ENUM('idle', 'awaiting_location');--> statement-breakpoint
CREATE TABLE "sms_conversations" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"from_number" text NOT NULL,
	"state" "sms_conversation_state" DEFAULT 'idle' NOT NULL,
	"pending_filter" jsonb,
	"last_location" text,
	"expires_at" timestamp with time zone NOT NULL,
	"last_message_at" timestamp with time zone DEFAULT now() NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX "sms_conversations_from_idx" ON "sms_conversations" USING btree ("from_number");--> statement-breakpoint
CREATE INDEX "sms_conversations_state_idx" ON "sms_conversations" USING btree ("state");--> statement-breakpoint
CREATE INDEX "sms_conversations_expires_idx" ON "sms_conversations" USING btree ("expires_at");