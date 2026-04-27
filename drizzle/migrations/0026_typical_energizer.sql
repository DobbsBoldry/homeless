CREATE TYPE "public"."client_document_kind" AS ENUM('photo_id', 'ssn_card', 'birth_certificate', 'dd_214', 'lease', 'paystub', 'court_record', 'other');--> statement-breakpoint
CREATE TYPE "public"."client_document_status" AS ENUM('uploaded', 'extracting', 'extracted', 'failed');--> statement-breakpoint
CREATE TABLE "client_documents" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"synthetic_person_ref" text,
	"kind" "client_document_kind" NOT NULL,
	"label" text NOT NULL,
	"content_md" text NOT NULL,
	"extracted_fields" jsonb,
	"extraction_notes" text,
	"extraction_model" text,
	"status" "client_document_status" DEFAULT 'uploaded' NOT NULL,
	"uploaded_by_user_id" uuid NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "client_documents" ADD CONSTRAINT "client_documents_uploaded_by_user_id_users_id_fk" FOREIGN KEY ("uploaded_by_user_id") REFERENCES "public"."users"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "client_documents_kind_idx" ON "client_documents" USING btree ("kind");--> statement-breakpoint
CREATE INDEX "client_documents_status_idx" ON "client_documents" USING btree ("status");--> statement-breakpoint
CREATE INDEX "client_documents_uploaded_by_idx" ON "client_documents" USING btree ("uploaded_by_user_id");--> statement-breakpoint
CREATE INDEX "client_documents_synthetic_ref_idx" ON "client_documents" USING btree ("synthetic_person_ref");