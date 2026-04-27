import { z } from 'zod';
import type {
  EvictionCauseType,
  EvictionFilingSource,
  EvictionFilingStatus,
} from '@/db/schema/enums';
import type { NewEvictionFiling } from '@/db/schema/eviction-filings';
import { detectChildrenSignal } from './children-detection';

/**
 * Pure function: take a raw filing record from any supported source and
 * return either a canonical NewEvictionFiling row (ready to insert) or a
 * structured ParseError listing every field that failed validation.
 *
 * Supported sources today:
 * - 'synthetic' — output of scripts/gen-synthetic-filings.ts (EVDT-024)
 * - 'manual'    — hand-entered records that already match the canonical shape
 *
 * 'courtnet' will land in EVDT-005 once the production scraper exists.
 *
 * Never throws — even bizarrely-shaped input returns ParseError. The dashboard
 * can render a row's parse status; the seed loader can skip+log; the production
 * scraper can dead-letter the failure for human review.
 */

export interface ParseError {
  ok: false;
  errors: Array<{ field: string; message: string }>;
  raw: unknown;
}

export interface ParseSuccess {
  ok: true;
  filing: NewEvictionFiling;
}

export type ParseResult = ParseSuccess | ParseError;

/**
 * Synthetic-source schema. Mirrors the output of the EVDT-024 generator
 * (src/ai/prompts/synthetic-eviction-filings.ts FilingSchema). We re-declare
 * here rather than importing so the parser can later support divergent source
 * shapes without a circular dep on the AI prompt module.
 */
const SyntheticSourceSchema = z.object({
  case_number: z.string().min(1),
  filed_at: z.string().min(1),
  court_division: z.string().nullable().optional(),
  plaintiff: z.string().min(1),
  defendant_first_name: z.string().min(1),
  defendant_last_name: z.string().min(1),
  defendant_address: z.string().nullable().optional(),
  cause_type: z.enum(['non_payment', 'lease_violation', 'holdover', 'other']),
  amount_claimed_cents: z.number().int().nullable().optional(),
  status: z.enum(['filed', 'served', 'judgment', 'dismissed', 'sealed']),
  notes: z.string().nullable().optional(),
  attorney_represented: z.boolean().nullable().optional(),
});

function zodToErrors(err: z.ZodError): ParseError['errors'] {
  return err.issues.map((i) => ({
    field: i.path.join('.') || '<root>',
    message: i.message,
  }));
}

function parseFiledAt(raw: string): Date | null {
  const d = new Date(raw);
  return Number.isNaN(d.getTime()) ? null : d;
}

export function parseEvictionFiling(
  raw: unknown,
  source: EvictionFilingSource = 'synthetic',
): ParseResult {
  if (source !== 'synthetic' && source !== 'manual') {
    return {
      ok: false,
      errors: [{ field: 'source', message: `unsupported source: ${source}` }],
      raw,
    };
  }

  const parsed = SyntheticSourceSchema.safeParse(raw);
  if (!parsed.success) {
    return { ok: false, errors: zodToErrors(parsed.error), raw };
  }
  const r = parsed.data;

  const filedAt = parseFiledAt(r.filed_at);
  if (!filedAt) {
    return {
      ok: false,
      errors: [{ field: 'filed_at', message: `not a valid date: ${r.filed_at}` }],
      raw,
    };
  }

  // Sealed records may legitimately omit defendant info — treat as ParseError
  // for now since our schema requires defendant_first/last_name. The production
  // pipeline will route sealed records to a separate redacted table.
  // (Synthetic fixtures don't currently emit sealed records, but we guard
  // explicitly so EVDT-005's CourtNet ingest doesn't crash on them.)

  const rawJson: Record<string, unknown> = {};
  if (r.notes != null) rawJson.notes = r.notes;
  if (r.attorney_represented != null) rawJson.attorney_represented = r.attorney_represented;

  // EVDT-011: deterministic children-in-household signal computed from
  // the notes text at parse time. Stored on rawJson so we don't need a
  // schema migration; the risk-score input + filing detail UI both
  // read from here. Always present (never undefined) so downstream
  // code can rely on the field shape.
  rawJson.children_signal = detectChildrenSignal(r.notes ?? null);

  const filing: NewEvictionFiling = {
    caseNumber: r.case_number,
    filedAt,
    courtDivision: r.court_division ?? null,
    plaintiff: r.plaintiff,
    defendantFirstName: r.defendant_first_name,
    defendantLastName: r.defendant_last_name,
    defendantAddress: r.defendant_address ?? null,
    causeType: r.cause_type as EvictionCauseType,
    amountClaimedCents: r.amount_claimed_cents ?? null,
    status: r.status as EvictionFilingStatus,
    source,
    rawJson: Object.keys(rawJson).length > 0 ? rawJson : undefined,
  };

  return { ok: true, filing };
}
