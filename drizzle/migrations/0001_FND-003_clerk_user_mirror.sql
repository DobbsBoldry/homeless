-- FND-388: 'pending' is created here (not via a later ALTER TYPE ADD VALUE) so
-- a clean `drizzle-kit migrate` from zero succeeds. The postgres-js migrator
-- runs the whole chain in ONE transaction, so a value ADDED by 0004 cannot be
-- used as a DEFAULT by 0005 in the same transaction ("unsafe use of new value").
-- Defining 'pending' at type-creation time sidesteps that; 0004's
-- `ADD VALUE IF NOT EXISTS 'pending'` then becomes a harmless no-op on fresh DBs.
CREATE TYPE "public"."user_role" AS ENUM('pending', 'attorney', 'caseworker', 'ed_coordinator', 'shelter_staff', 'admin');--> statement-breakpoint
CREATE TABLE "users" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"clerk_user_id" text NOT NULL,
	"email" text NOT NULL,
	"first_name" text,
	"last_name" text,
	"role" "user_role" DEFAULT 'caseworker' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX "users_clerk_user_id_idx" ON "users" USING btree ("clerk_user_id");