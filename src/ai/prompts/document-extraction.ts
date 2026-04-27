import { z } from 'zod';
import type { ClientDocumentKind } from '@/db/schema/enums';

/**
 * Document extraction prompt (CWT-021). Takes raw document text the
 * caseworker pastes (or that came from a PDF text-extract pre-pass)
 * and returns a structured field set the case-management UI can show
 * at a glance.
 *
 * Phase-1 scope: text-only inputs, synthetic / staff-pasted documents
 * that don't carry real PHI. Real client documents wait for the
 * post-BAA storage migration; the same prompt applies.
 */

export const DOCUMENT_EXTRACTION_MODEL_VERSION = 'doc-extract-v1@2026-04-26';

export const DOCUMENT_EXTRACTION_SYSTEM_PROMPT = `You extract structured fields from documents that a coalition
caseworker has uploaded on a client's behalf. The output goes into a
case-management view that helps the caseworker fill out benefits
applications, housing voucher paperwork, and re-issue lost IDs.

Your goals, in order:
1. Extract every field listed in the per-document-kind contract below.
2. Flag any field you can't confidently read. Use null and explain in 'notes'.
3. Never invent values. If a date isn't in the document, don't guess it.
4. Don't echo PII back outside the structured output. Your text-only
   'notes' should describe what you saw, not name names.

The structured fields you must produce, by document kind:

- photo_id: full_name, date_of_birth (YYYY-MM-DD), document_number,
  expiration_date (YYYY-MM-DD or null), address (line1 string,
  city, state, postal_code), document_authority (e.g. "Kentucky
  Transportation Cabinet"), notes.

- ssn_card: full_name, ssn (string, leave dashes if present), notes.
  Reminder: SSN is restricted; only extract when the document is
  clearly the SSN card itself.

- birth_certificate: full_name, date_of_birth, place_of_birth, parents
  (array of strings), document_number (state file/registry number),
  issuing_state, notes.

- dd_214: full_name, branch ("Army"/"Navy"/etc.), service_start_date,
  service_end_date, discharge_type ("Honorable"/"General"/etc.),
  rank_at_separation, notes.

- lease: tenant_names (array), landlord_name, monthly_rent_dollars
  (number, no $), lease_start (YYYY-MM-DD), lease_end (YYYY-MM-DD or
  null for month-to-month), property_address, security_deposit_dollars
  (number or null), notes.

- paystub: employer, gross_pay_dollars (most recent period, number),
  net_pay_dollars (number), pay_period_start (YYYY-MM-DD),
  pay_period_end (YYYY-MM-DD), pay_frequency ("weekly"/"biweekly"/
  "semimonthly"/"monthly"/null), ytd_gross_dollars (number or null),
  notes.

- court_record: case_number, court ("Daviess District Court"...),
  parties (object: plaintiff/defendant), filing_date (YYYY-MM-DD),
  status, summary (1-3 sentences), notes.

- other: notes (describe what kind of document this looks like).

Output ONLY valid JSON matching the schema. No prose outside the JSON.`;

const PhotoIdSchema = z.object({
  full_name: z.string().nullable(),
  date_of_birth: z.string().nullable(),
  document_number: z.string().nullable(),
  expiration_date: z.string().nullable(),
  address: z
    .object({
      line1: z.string().nullable(),
      city: z.string().nullable(),
      state: z.string().nullable(),
      postal_code: z.string().nullable(),
    })
    .nullable(),
  document_authority: z.string().nullable(),
  notes: z.string().nullable(),
});

const SsnCardSchema = z.object({
  full_name: z.string().nullable(),
  ssn: z.string().nullable(),
  notes: z.string().nullable(),
});

const BirthCertSchema = z.object({
  full_name: z.string().nullable(),
  date_of_birth: z.string().nullable(),
  place_of_birth: z.string().nullable(),
  parents: z.array(z.string()).nullable(),
  document_number: z.string().nullable(),
  issuing_state: z.string().nullable(),
  notes: z.string().nullable(),
});

const Dd214Schema = z.object({
  full_name: z.string().nullable(),
  branch: z.string().nullable(),
  service_start_date: z.string().nullable(),
  service_end_date: z.string().nullable(),
  discharge_type: z.string().nullable(),
  rank_at_separation: z.string().nullable(),
  notes: z.string().nullable(),
});

const LeaseSchema = z.object({
  tenant_names: z.array(z.string()).nullable(),
  landlord_name: z.string().nullable(),
  monthly_rent_dollars: z.number().nullable(),
  lease_start: z.string().nullable(),
  lease_end: z.string().nullable(),
  property_address: z.string().nullable(),
  security_deposit_dollars: z.number().nullable(),
  notes: z.string().nullable(),
});

const PaystubSchema = z.object({
  employer: z.string().nullable(),
  gross_pay_dollars: z.number().nullable(),
  net_pay_dollars: z.number().nullable(),
  pay_period_start: z.string().nullable(),
  pay_period_end: z.string().nullable(),
  pay_frequency: z.string().nullable(),
  ytd_gross_dollars: z.number().nullable(),
  notes: z.string().nullable(),
});

const CourtRecordSchema = z.object({
  case_number: z.string().nullable(),
  court: z.string().nullable(),
  parties: z
    .object({
      plaintiff: z.string().nullable(),
      defendant: z.string().nullable(),
    })
    .nullable(),
  filing_date: z.string().nullable(),
  status: z.string().nullable(),
  summary: z.string().nullable(),
  notes: z.string().nullable(),
});

const OtherSchema = z.object({
  notes: z.string().nullable(),
});

export const ExtractionSchemaByKind: Record<ClientDocumentKind, z.ZodType> = {
  photo_id: PhotoIdSchema,
  ssn_card: SsnCardSchema,
  birth_certificate: BirthCertSchema,
  dd_214: Dd214Schema,
  lease: LeaseSchema,
  paystub: PaystubSchema,
  court_record: CourtRecordSchema,
  other: OtherSchema,
};

export function buildExtractionUserPrompt(kind: ClientDocumentKind, contentMd: string): string {
  return `Document kind: ${kind}\n\nDocument text:\n\n${contentMd}\n\nReturn JSON matching the schema for ${kind}. Use null for fields you cannot confidently read.`;
}
