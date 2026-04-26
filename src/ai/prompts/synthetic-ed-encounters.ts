import { z } from 'zod';

/**
 * Single source of truth for the prompt used to generate synthetic ED
 * encounters for the ESUC (super-utilizer care coordination) pipeline.
 * Mirror of synthetic-eviction-filings.ts. Lives in src/ai/prompts/.
 *
 * The PHI fence (CLAUDE.md): we cannot send Owensboro Health's real ED
 * encounters to the Anthropic API until the BAA + HIPAA-eligible endpoint
 * are in place (ESUC-001/003). This generator gives us realistic shapes
 * to build the rest of the ESUC stack against in the meantime.
 */

export const SYNTHETIC_ED_ENCOUNTER_SYSTEM_PROMPT = `You generate synthetic ED (emergency department) encounter records for a
homelessness coalition platform's development environment. The records mimic
the kind of data Owensboro Health's Epic FHIR feed would produce so we can
iterate on the super-utilizer detection, AI care plan generator, and care
coordinator workflow against realistic shapes — without touching any real
patient data.

Hard rules — every output MUST satisfy:

1. patient_id begins with the literal prefix \`SYN-PAT-\` (e.g.
   \`SYN-PAT-001234\`). NEVER produce a value that could be a real MRN or
   name. Reuse the same patient_id across multiple encounters when
   modeling a super-utilizer (3+ visits in 6 months).
2. encounter_external_id begins with \`SYN-ENC-\` and is unique per encounter.
3. chief_complaint uses real ED chief-complaint vocabulary but no
   identifying details ("chest pain", "abdominal pain", "alcohol withdrawal",
   "suicidal ideation", "dyspnea", "fall", "hypertensive urgency", etc.)
4. disposition is one of: 'discharged-home', 'admitted', 'transferred',
   'ama' (against medical advice), 'expired'.
5. housing_status is one of: 'housed', 'doubled_up', 'shelter', 'unsheltered',
   'unknown'. Roughly 30% of synthetic patients should be 'shelter' or
   'unsheltered' (housing-unstable) — these are the cohort the platform
   coordinates care for.
6. arrived_at and discharged_at are ISO 8601 timestamps with Central Time
   offset (-06:00 winter, -05:00 March-November). discharged_at is 1-12
   hours after arrived_at, or null for admitted patients still inpatient.
7. notes are 1-2 sentences, plausible but generic. NEVER include any
   real-sounding name or address.
8. charge_cents is an integer (or null) — typical ED visit $1,500-$8,000
   in cents (150_000 to 800_000); higher for admitted patients.

Diversity goals — across the batch, span:

- Patient repeat-visit pattern: ~20% of unique patient_ids should appear
  3+ times within the time window (super-utilizer signal). The rest are
  single-visit patients.
- Chief complaints: weight toward conditions associated with housing
  instability — substance use, mental health crises, untreated chronic
  disease, falls, infections, hypothermia, hyperthermia. Mix in some
  acute presentations (chest pain, MVA injuries) for realism.
- Housing status: ~40% housed, ~10% doubled_up, ~15% shelter, ~10%
  unsheltered, ~25% unknown.
- Time spread: arrived_at dates spread across the 90 days BEFORE the
  "today" date supplied in the user message.

Return ONLY a JSON object with an "encounters" array. No prose, no markdown.`;

export const buildEdUserPrompt = (count: number, seed: number, todayISO: string) =>
  `Generate ${count} synthetic ED encounters.

Today's date is ${todayISO}. arrived_at should fall within the 90 days
prior to today.

Variation seed: ${seed}. Use this to vary chief complaints, dispositions,
and patient distributions across runs. The seed is a hint, not a strict
deterministic input.

Return a single JSON object: { "encounters": [...] }.`;

export const EdEncounterSchema = z.object({
  patient_id: z.string().startsWith('SYN-PAT-'),
  encounter_external_id: z.string().startsWith('SYN-ENC-'),
  arrived_at: z.string(),
  discharged_at: z.string().nullable(),
  chief_complaint: z.string(),
  disposition: z.enum(['discharged-home', 'admitted', 'transferred', 'ama', 'expired']),
  housing_status: z.enum(['housed', 'doubled_up', 'shelter', 'unsheltered', 'unknown']),
  charge_cents: z.number().int().nullable(),
  notes: z.string(),
});

export const EdEncounterBatchSchema = z.object({
  encounters: z.array(EdEncounterSchema),
});

export type SyntheticEdEncounter = z.infer<typeof EdEncounterSchema>;
