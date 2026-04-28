CREATE TABLE "sms_messages" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"provider_message_id" text,
	"from_number" text NOT NULL,
	"to_number" text NOT NULL,
	"body" text NOT NULL,
	"intent" text NOT NULL,
	"reply_body" text NOT NULL,
	"metadata" jsonb,
	"received_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE INDEX "sms_messages_received_idx" ON "sms_messages" USING btree ("received_at");--> statement-breakpoint
CREATE INDEX "sms_messages_from_idx" ON "sms_messages" USING btree ("from_number");