-- SUBP-005 — reentry pathway pre-release subjects (ADR 0009).
--
-- One table: `pre_release_subjects`. Two new enums:
-- pre_release_subject_status, pre_release_release_type.
--
-- Persistence is gated at runtime by an active KY DOC DSA — see
-- src/lib/subp/kydoc-gate.ts. This migration is the storage layer; the
-- gate is enforced at the query / ingest path, not at the DB level.
--
-- Bounded data flow: subjects are deleted by a daily Inngest sweep when
-- they age past 7 days post-release without a warm handoff (ADR 0009 § 5.1).
-- That sweep is implemented in src/inngest/functions/pre-release-window-sweep.ts.

CREATE TYPE "public"."pre_release_subject_status" AS ENUM (
  'active',
  'handed_off'
);--> statement-breakpoint

CREATE TYPE "public"."pre_release_release_type" AS ENUM (
  'sentence_expiration',
  'parole',
  'transfer',
  'other'
);--> statement-breakpoint

CREATE TABLE "pre_release_subjects" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  -- KY DOC partner_org under whose DSA this row was ingested. Runtime gate
  -- in subp/kydoc-gate.ts looks up the active agreement via this FK.
  -- ON DELETE RESTRICT — admin must terminate the DSA explicitly.
  "ky_doc_partner_org_id" uuid NOT NULL,
  -- Synthetic KY DOC inmate ID; replaced post-BAA / post-integration.
  "ky_doc_inmate_id" text NOT NULL,
  -- Synthetic name fields — synthetic data only until KY DOC BAA closes.
  "legal_first_name" text NOT NULL,
  "legal_last_name" text NOT NULL,
  -- Required for caseworker identification at warm handoff.
  "date_of_birth" date NOT NULL,
  -- Projected release date. Bounded-data-flow sweep computes
  -- days-until-release from this and now().
  "projected_release_date" date NOT NULL,
  "release_type" "pre_release_release_type" NOT NULL,
  -- Free-text city/county/ZIP designating where the subject intends to live
  -- post-release. The Daviess County scope is enforced at synth/ingest time.
  "designated_destination" text NOT NULL,
  -- Coalition caseworker assigned to coordinate warm handoff.
  "assigned_caseworker_user_id" uuid,
  -- Structured pre-release supports payload (see PreReleaseSupports type).
  "supports_in_place" jsonb NOT NULL,
  "status" "pre_release_subject_status" NOT NULL DEFAULT 'active',
  -- Set when caseworker confirms successful warm handoff. Subjects with a
  -- non-null handed_off_at are exempt from window-expiration sweep.
  "handed_off_at" timestamp with time zone,
  "notes" text,
  "created_at" timestamp with time zone NOT NULL DEFAULT now(),
  "updated_at" timestamp with time zone NOT NULL DEFAULT now()
);--> statement-breakpoint

ALTER TABLE "pre_release_subjects"
  ADD CONSTRAINT "pre_release_subjects_ky_doc_partner_org_id_fk"
  FOREIGN KEY ("ky_doc_partner_org_id") REFERENCES "public"."partner_orgs"("id") ON DELETE RESTRICT;--> statement-breakpoint

ALTER TABLE "pre_release_subjects"
  ADD CONSTRAINT "pre_release_subjects_assigned_caseworker_user_id_fk"
  FOREIGN KEY ("assigned_caseworker_user_id") REFERENCES "public"."users"("id") ON DELETE SET NULL;--> statement-breakpoint

CREATE INDEX "pre_release_subjects_partner_idx" ON "pre_release_subjects" USING btree ("ky_doc_partner_org_id");--> statement-breakpoint
CREATE INDEX "pre_release_subjects_caseworker_idx" ON "pre_release_subjects" USING btree ("assigned_caseworker_user_id");--> statement-breakpoint
CREATE INDEX "pre_release_subjects_status_idx" ON "pre_release_subjects" USING btree ("status");--> statement-breakpoint
CREATE INDEX "pre_release_subjects_release_date_idx" ON "pre_release_subjects" USING btree ("projected_release_date");
