-- SUBP-004 — DV survivor pathway (ADR 0007).
--
-- Two tables: `dv_survivors` (synthetic individual records, gated at runtime
-- by the active OASIS DSA + assigned-advocate match) and `dv_safety_events`
-- (append-only per-survivor event log).
--
-- Three new enums: dv_survivor_status, dv_risk_tier, dv_safety_event_type.
--
-- Direct queries against these tables outside src/lib/subp/ are forbidden by
-- the boundary lint — the abuser-blind middleware in src/lib/subp/abuser-blind.ts
-- is the only authorized access path.

CREATE TYPE "public"."dv_survivor_status" AS ENUM (
  'active',
  'exited',
  'transferred',
  'deceased'
);--> statement-breakpoint

CREATE TYPE "public"."dv_risk_tier" AS ENUM (
  'unknown',
  'lethality_low',
  'lethality_moderate',
  'lethality_high'
);--> statement-breakpoint

CREATE TYPE "public"."dv_safety_event_type" AS ENUM (
  'intake',
  'safety_plan_update',
  'escalation',
  'service_referral',
  'exit'
);--> statement-breakpoint

CREATE TABLE "dv_survivors" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  -- OASIS partner_org under whose DSA this row was ingested. Runtime gate
  -- in subp/abuser-blind.ts looks up the active agreement via this FK.
  -- ON DELETE RESTRICT — admin must terminate the DSA explicitly.
  "oasis_partner_org_id" uuid NOT NULL,
  -- Synthetic OASIS case identifier; replaced post-DSA / integration.
  "oasis_case_id" text NOT NULL,
  "enrolled_at" timestamp with time zone NOT NULL DEFAULT now(),
  "status" "dv_survivor_status" NOT NULL DEFAULT 'active',
  -- Coalition advocate (caseworker role) assigned to this survivor.
  -- Required for non-admin reads — see isAuthorizedReader in abuser-blind.ts.
  "assigned_advocate_user_id" uuid,
  -- True when OASIS has a written safety plan on file. Plan content is never persisted here.
  "safety_plan_on_file" boolean NOT NULL DEFAULT false,
  -- Last time OASIS confirmed the safety plan was reviewed/updated.
  "safety_plan_last_reviewed_at" timestamp with time zone,
  -- Structured needs assessment payload (see DvNeedsAssessment type). Categorical only.
  "needs_assessment" jsonb NOT NULL,
  "risk_tier" "dv_risk_tier" NOT NULL DEFAULT 'unknown',
  "created_at" timestamp with time zone NOT NULL DEFAULT now(),
  "updated_at" timestamp with time zone NOT NULL DEFAULT now()
);--> statement-breakpoint

ALTER TABLE "dv_survivors"
  ADD CONSTRAINT "dv_survivors_oasis_partner_org_id_fk"
  FOREIGN KEY ("oasis_partner_org_id") REFERENCES "public"."partner_orgs"("id") ON DELETE RESTRICT;--> statement-breakpoint

ALTER TABLE "dv_survivors"
  ADD CONSTRAINT "dv_survivors_assigned_advocate_user_id_fk"
  FOREIGN KEY ("assigned_advocate_user_id") REFERENCES "public"."users"("id") ON DELETE SET NULL;--> statement-breakpoint

CREATE INDEX "dv_survivors_oasis_partner_idx" ON "dv_survivors" USING btree ("oasis_partner_org_id");--> statement-breakpoint
CREATE INDEX "dv_survivors_assigned_advocate_idx" ON "dv_survivors" USING btree ("assigned_advocate_user_id");--> statement-breakpoint
CREATE INDEX "dv_survivors_status_idx" ON "dv_survivors" USING btree ("status");--> statement-breakpoint
CREATE INDEX "dv_survivors_risk_tier_idx" ON "dv_survivors" USING btree ("risk_tier");--> statement-breakpoint

CREATE TABLE "dv_safety_events" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "survivor_id" uuid NOT NULL,
  "event_type" "dv_safety_event_type" NOT NULL,
  "occurred_at" timestamp with time zone NOT NULL DEFAULT now(),
  -- Coalition advocate / admin who recorded the event. SET NULL on user delete.
  "recorded_by_user_id" uuid,
  -- Short categorical summary; never narrative.
  "summary" text NOT NULL,
  "created_at" timestamp with time zone NOT NULL DEFAULT now()
);--> statement-breakpoint

ALTER TABLE "dv_safety_events"
  ADD CONSTRAINT "dv_safety_events_survivor_id_fk"
  FOREIGN KEY ("survivor_id") REFERENCES "public"."dv_survivors"("id") ON DELETE CASCADE;--> statement-breakpoint

ALTER TABLE "dv_safety_events"
  ADD CONSTRAINT "dv_safety_events_recorded_by_user_id_fk"
  FOREIGN KEY ("recorded_by_user_id") REFERENCES "public"."users"("id") ON DELETE SET NULL;--> statement-breakpoint

CREATE INDEX "dv_safety_events_survivor_idx" ON "dv_safety_events" USING btree ("survivor_id");--> statement-breakpoint
CREATE INDEX "dv_safety_events_occurred_idx" ON "dv_safety_events" USING btree ("occurred_at");--> statement-breakpoint
CREATE INDEX "dv_safety_events_type_idx" ON "dv_safety_events" USING btree ("event_type");
