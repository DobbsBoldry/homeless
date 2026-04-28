-- PRVN-003 — McKinney-Vento school referral schema (FERPA fork)
-- See ADR 0005 for the consent-regime decision.
--
-- Three tables:
--   school_referrals            — inbound referral record (FERPA minimum-necessary)
--   school_referral_consents    — legal-basis row per referral
--   school_referral_disclosures — FERPA § 99.32 annual disclosure log
--
-- Privacy contract:
--   No student last name or date of birth anywhere in this schema.
--   All reads must go through canAccessSchoolReferral (school-referral-policy.ts).
--   Every non-directory-info read writes a row to school_referral_disclosures.

CREATE TYPE "public"."school_referral_basis" AS ENUM(
  'mckinney_vento_authorization',
  'parental_consent',
  'eligible_student_consent',
  'directory_info_only',
  'health_safety_emergency'
);--> statement-breakpoint

CREATE TYPE "public"."school_referral_status" AS ENUM(
  'received',
  'triaged',
  'in_progress',
  'connected',
  'closed_unreachable',
  'closed_completed'
);--> statement-breakpoint

CREATE TYPE "public"."school_referral_grade_band" AS ENUM(
  'elementary',
  'middle',
  'high'
);--> statement-breakpoint

CREATE TYPE "public"."school_referral_urgency" AS ENUM(
  'low',
  'medium',
  'high'
);--> statement-breakpoint

CREATE TABLE "school_referrals" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  -- School district's partner_org row; liaisons submit under their org
  "partner_org_id" uuid NOT NULL,
  -- The liaisons who submitted this referral (must be authenticated)
  "referring_user_id" uuid NOT NULL,
  -- FERPA minimum-necessary: first initial only — NO last name, NO DOB
  "student_first_initial" text NOT NULL,
  "student_age" integer,
  "student_grade_band" "school_referral_grade_band",
  -- Guardian info for service coordination contact
  "guardian_name" text NOT NULL,
  "guardian_contact" text NOT NULL,
  -- Free-text housing situation description
  "housing_situation" text NOT NULL,
  -- Controlled vocabulary array — see SCHOOL_REFERRAL_SERVICES in school-referral-policy.ts
  "services_requested" jsonb NOT NULL DEFAULT '[]'::jsonb,
  "urgency" "school_referral_urgency" NOT NULL DEFAULT 'medium',
  "notes" text,
  "status" "school_referral_status" NOT NULL DEFAULT 'received',
  "mv_authorization_confirmed" boolean NOT NULL DEFAULT false,
  "received_at" timestamp with time zone NOT NULL DEFAULT now(),
  "last_updated_at" timestamp with time zone NOT NULL DEFAULT now()
);--> statement-breakpoint

ALTER TABLE "school_referrals"
  ADD CONSTRAINT "school_referrals_partner_org_id_fk"
  FOREIGN KEY ("partner_org_id") REFERENCES "public"."partner_orgs"("id") ON DELETE RESTRICT;--> statement-breakpoint

ALTER TABLE "school_referrals"
  ADD CONSTRAINT "school_referrals_referring_user_id_fk"
  FOREIGN KEY ("referring_user_id") REFERENCES "public"."users"("id") ON DELETE RESTRICT;--> statement-breakpoint

CREATE INDEX "school_referrals_partner_org_idx" ON "school_referrals" USING btree ("partner_org_id");--> statement-breakpoint
CREATE INDEX "school_referrals_status_idx" ON "school_referrals" USING btree ("status");--> statement-breakpoint
CREATE INDEX "school_referrals_received_at_idx" ON "school_referrals" USING btree ("received_at" DESC);--> statement-breakpoint

-- Per ADR 0005 schema verbatim
CREATE TABLE "school_referral_consents" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "referral_id" uuid NOT NULL,
  "basis" "school_referral_basis" NOT NULL,
  -- null for M-V authorization (no consent collected — statutory basis)
  "consenter_relationship" text,
  -- redacted in non-admin views
  "consenter_name" text,
  -- e.g. 'ferpa-parental-v1'; M-V rows use sentinel 'mckinney_vento_v1' (NOT NULL)
  "consent_text_version" text NOT NULL,
  -- null when basis is mckinney_vento_authorization
  "signed_at" timestamp with time zone,
  -- 'in_person' | 'web_form' | 'phone'
  "signed_method" text,
  -- which data classes, which partners, which time window
  "scope" jsonb NOT NULL DEFAULT '{}'::jsonb,
  "expires_at" timestamp with time zone,
  "revoked_at" timestamp with time zone,
  "created_at" timestamp with time zone NOT NULL DEFAULT now()
);--> statement-breakpoint

ALTER TABLE "school_referral_consents"
  ADD CONSTRAINT "school_referral_consents_referral_id_fk"
  FOREIGN KEY ("referral_id") REFERENCES "public"."school_referrals"("id") ON DELETE CASCADE;--> statement-breakpoint

CREATE INDEX "school_referral_consents_referral_idx" ON "school_referral_consents" USING btree ("referral_id");--> statement-breakpoint

-- FERPA § 99.32 annual disclosure log — per ADR 0005 schema verbatim
CREATE TABLE "school_referral_disclosures" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "referral_id" uuid NOT NULL,
  "accessed_by_user_id" uuid,
  "accessed_by_partner_org_id" uuid,
  -- structured purpose string e.g. 'caseworker_case_detail', 'caseworker_queue_view'
  "purpose" text NOT NULL,
  -- which authorization permitted this access
  "basis" "school_referral_basis" NOT NULL,
  "accessed_at" timestamp with time zone NOT NULL DEFAULT now(),
  "data_classes_disclosed" jsonb NOT NULL DEFAULT '[]'::jsonb
);--> statement-breakpoint

ALTER TABLE "school_referral_disclosures"
  ADD CONSTRAINT "school_referral_disclosures_referral_id_fk"
  FOREIGN KEY ("referral_id") REFERENCES "public"."school_referrals"("id") ON DELETE CASCADE;--> statement-breakpoint

ALTER TABLE "school_referral_disclosures"
  ADD CONSTRAINT "school_referral_disclosures_user_id_fk"
  FOREIGN KEY ("accessed_by_user_id") REFERENCES "public"."users"("id") ON DELETE SET NULL;--> statement-breakpoint

ALTER TABLE "school_referral_disclosures"
  ADD CONSTRAINT "school_referral_disclosures_partner_org_id_fk"
  FOREIGN KEY ("accessed_by_partner_org_id") REFERENCES "public"."partner_orgs"("id") ON DELETE SET NULL;--> statement-breakpoint

CREATE INDEX "school_referral_disclosures_referral_idx" ON "school_referral_disclosures" USING btree ("referral_id");--> statement-breakpoint
CREATE INDEX "school_referral_disclosures_user_idx" ON "school_referral_disclosures" USING btree ("accessed_by_user_id");--> statement-breakpoint
CREATE INDEX "school_referral_disclosures_accessed_at_idx" ON "school_referral_disclosures" USING btree ("accessed_at" DESC);--> statement-breakpoint
