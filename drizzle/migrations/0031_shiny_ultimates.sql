CREATE TABLE "outbound_messages_test" (
	"id" serial PRIMARY KEY NOT NULL,
	"kind" text NOT NULL,
	"to" text NOT NULL,
	"body" text NOT NULL,
	"metadata" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
