-- COOR-014 — school_referral_status_events table (append-only transition log)
--
-- Design: option B (append-only log) over option A (overwriting column).
--   - Preserves full transition history for FERPA audit compliance.
--   - Liaison dashboard reads the latest event's note; history is always available.
--   - CHECK constraint (note length) is defense-in-depth; app layer enforces 500 chars.
--
-- Journal idx 36 (post-PRVN-003's idx 35).

CREATE TABLE "school_referral_status_events" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  -- parent referral — cascade delete so orphans can't accumulate
  "referral_id" uuid NOT NULL,
  -- null on the first recorded transition (no prior status on record)
  "from_status" "school_referral_status",
  "to_status" "school_referral_status" NOT NULL,
  -- caseworker or admin who made the transition; SET NULL on user delete
  "actor_user_id" uuid,
  -- optional note surfaced to the school liaison (max 500 chars at app layer)
  "note" text,
  -- defense-in-depth CHECK: DB allows up to 1 000 chars
  CONSTRAINT "school_referral_status_events_note_length" CHECK (note IS NULL OR length(note) <= 1000),
  "occurred_at" timestamp with time zone NOT NULL DEFAULT now()
);--> statement-breakpoint

ALTER TABLE "school_referral_status_events"
  ADD CONSTRAINT "school_referral_status_events_referral_id_fk"
  FOREIGN KEY ("referral_id") REFERENCES "public"."school_referrals"("id") ON DELETE CASCADE;--> statement-breakpoint

ALTER TABLE "school_referral_status_events"
  ADD CONSTRAINT "school_referral_status_events_actor_user_id_fk"
  FOREIGN KEY ("actor_user_id") REFERENCES "public"."users"("id") ON DELETE SET NULL;--> statement-breakpoint

-- Descending occurred_at so the latest event is fetched first without re-sorting.
CREATE INDEX "school_referral_status_events_referral_idx"
  ON "school_referral_status_events" USING btree ("referral_id", "occurred_at" DESC);--> statement-breakpoint

-- Append-only enforcement (mirrors audit_log_append_only, migration 0008).
-- school_referral_status_events is a FERPA audit log — rows must never be
-- mutated or deleted. A DB-level trigger is used (not REVOKE) because all
-- operations share the same service-role user (see 0008 for the rationale;
-- when ESUC-002 splits roles on AWS RDS, add a REVOKE layer as defense-in-depth).
CREATE OR REPLACE FUNCTION school_referral_status_events_block_mutation()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  RAISE EXCEPTION 'school_referral_status_events is append-only; % is not permitted',
    TG_OP USING ERRCODE = 'feature_not_supported';
END;
$$;--> statement-breakpoint

CREATE TRIGGER school_referral_status_events_no_update
BEFORE UPDATE ON school_referral_status_events
FOR EACH ROW EXECUTE FUNCTION school_referral_status_events_block_mutation();--> statement-breakpoint

CREATE TRIGGER school_referral_status_events_no_delete
BEFORE DELETE ON school_referral_status_events
FOR EACH ROW EXECUTE FUNCTION school_referral_status_events_block_mutation();--> statement-breakpoint

-- BEFORE DELETE FOR EACH ROW does not fire on TRUNCATE — close the last
-- DDL-adjacent hole with a statement-level trigger (mirrors audit_log, 0008).
CREATE TRIGGER school_referral_status_events_no_truncate
BEFORE TRUNCATE ON school_referral_status_events
FOR EACH STATEMENT EXECUTE FUNCTION school_referral_status_events_block_mutation();--> statement-breakpoint
