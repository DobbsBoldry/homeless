import { z } from 'zod';

/**
 * Single source of truth for the prompt used to generate synthetic Daviess
 * District Court eviction filings. Lives in src/ai/prompts/ per CLAUDE.md.
 *
 * Why structured output: Claude's `messages.parse()` with a zod schema
 * gives us validated rows we can insert directly into eviction_filings
 * without a hand-written runtime guard.
 */

export const SYNTHETIC_FILING_SYSTEM_PROMPT = `You generate synthetic court records for a homelessness coalition platform's
development environment. The records mimic the Daviess District Court (Owensboro, KY)
eviction docket so we can iterate on parsers, dashboards, and AI risk-scoring
against realistic shapes WITHOUT touching real cases of real people in distress.

Hard rules — every output MUST satisfy:

1. Case numbers begin with the literal prefix \`SYN-\` (e.g. \`SYN-26-CI-00123\`).
   Never use a real KY court case number format like \`26-CI-00123\` without the prefix.
2. Defendant names come from a clearly fictional palette. Use surnames that
   sound synthetic (Synthwell, Fakeman, Dummond, Placholder, Mockton, Stubbs)
   paired with common first names. NEVER use real Owensboro residents or
   plausibly-real names.
3. Defendant addresses, when present, must be obviously fake:
   "123 Synth St", "456 Fake Ave", "789 Dummy Lane", "Apt 4B Mock Plaza".
   Never use a real Owensboro street name.
4. Plaintiff names should sound like local landlords or property managers
   but be clearly synthetic: "Mock Property Holdings LLC", "Fake Apartments
   of Owensboro", "Synth Realty Trust", individuals like "John Mockton".

Diversity goals — across the batch, span:

- Cause types: roughly 60% non_payment, 20% lease_violation, 15% holdover, 5% other
- Status mix: mostly 'filed' (recent), some 'served', a few 'judgment' or 'dismissed'
- Amount claimed (cents): non_payment cases $400-$5000 (rounded to nearest dollar),
  null for some lease_violation / holdover cases
- Court divisions: "1st Division", "2nd Division", "Small Claims"
- Filed dates: spread across the 60 days BEFORE the "today" date supplied in the user message. Use ISO 8601 with Central Time offset (-06:00 in winter, -05:00 March-November).
- Notes: 1-2 sentence allegation summary that's plausible but generic
- Attorney representation: ~25% of defendants represented (capture in notes
  as "Defendant represented by counsel" when true)

Return ONLY a JSON object with a "filings" array. No prose, no markdown fences.`;

export const buildUserPrompt = (count: number, seed: number, todayISO: string) =>
  `Generate ${count} synthetic Daviess District Court eviction filings.

Today's date is ${todayISO}. Filed dates should fall within the 60 days
prior to today (i.e. between ~60 days ago and yesterday).

Variation seed: ${seed}. Use this to add stylistic variation across runs
(different mix of plaintiffs, addresses, allegation phrasings). The seed
is a hint, not a strict deterministic input.

Return a single JSON object: { "filings": [...] }.`;

export const FilingSchema = z.object({
  case_number: z.string().startsWith('SYN-'),
  filed_at: z.string(),
  court_division: z.string(),
  plaintiff: z.string(),
  defendant_first_name: z.string(),
  defendant_last_name: z.string(),
  defendant_address: z.string().nullable(),
  cause_type: z.enum(['non_payment', 'lease_violation', 'holdover', 'other']),
  amount_claimed_cents: z.number().int().nullable(),
  status: z.enum(['filed', 'served', 'judgment', 'dismissed', 'sealed']),
  notes: z.string(),
  attorney_represented: z.boolean(),
});

export const FilingBatchSchema = z.object({
  filings: z.array(FilingSchema),
});

export type SyntheticFiling = z.infer<typeof FilingSchema>;
