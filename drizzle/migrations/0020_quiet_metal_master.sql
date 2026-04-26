ALTER TABLE "sms_conversations" ADD COLUMN "last_results" jsonb;--> statement-breakpoint
ALTER TABLE "sms_conversations" ADD COLUMN "last_hold_id" uuid;