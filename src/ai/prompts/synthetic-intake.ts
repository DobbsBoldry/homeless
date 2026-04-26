import { z } from 'zod';

/**
 * Single source of truth for the prompt that generates synthetic shelter-intake
 * conversations. Lives in src/ai/prompts/ per CLAUDE.md.
 *
 * These transcripts are the test foundation for the entire CWT (Caseworker
 * Tools) and INDC (Individual Companion) epics — anything that takes a
 * client-facing conversation as input. Real PHI never enters dev/test;
 * synthetic transcripts approximate the shape, tone, and emotional weight
 * without exposing real people in distress.
 */

export const SYNTHETIC_INTAKE_SYSTEM_PROMPT = `You generate synthetic shelter-intake conversation transcripts for a
homelessness coalition platform's development environment.

Each transcript is a conversation between a "caseworker" (case manager
conducting an intake interview) and a "client" (the person seeking help).
The transcripts will train and evaluate AI systems that triage, summarize,
and route real intakes — so they need to feel real WITHOUT being real.

Hard rules — every output MUST satisfy:

1. All names are clearly synthetic. Use first names paired with surnames
   that obviously don't belong to real people: Synthwell, Fakeman, Dummond,
   Placholder, Mockton, Stubbs, Paperton, Voidman.
2. All addresses are clearly fake: "123 Synth St", "Fake Apartments Unit 4B",
   "Mock Plaza Lot 12". Never use a real Owensboro / Daviess County street.
3. Phone numbers use 555-01XX (RFC-reserved fictional range) when present.
4. Specific dates of birth, SSNs, account numbers, etc. — never include them.
   If the conversation needs an age or DOB, say "in their 30s" or "born in
   the early 1970s" — vague enough to never match a real person.
5. Tone is realistic and respectful — clients in housing crisis often present
   trauma, exhaustion, distrust of systems, complex family situations.
   Caseworkers sound like they actually do this work — patient, non-judgmental,
   asking open-ended questions.

Diversity goals — across the batch, span:

- Presenting issues: eviction filing, ED super-utilizer, family separation,
  domestic violence, mental health crisis, substance use disorder, working
  poor (housed but cost-burdened), youth aging out of foster care, justice-
  involved person re-entering, veteran with VA gap
- Household compositions: single adult, single parent + kids, intact family,
  multi-generational, unaccompanied minor (rare)
- Urgency levels: same-night need, 7-day deadline (court date), exploring options
- Length: 8 to 25 turns per conversation, varied
- Outcomes implied (not stated): some lead to bed placement, some to legal
  referral, some to ED care coordination, some need more conversation

Output format — STRICT JSON:
{ "intakes": [
    {
      "intake_id": "SYN-INT-<6-digit>",
      "presenting_issue": "<short label, see Presenting issues above>",
      "urgency": "same_night | within_7_days | exploring",
      "client_pseudonym": "<clearly fake first + last name>",
      "household_composition": "<short string>",
      "started_at": "<ISO 8601 timestamp with -05:00 or -06:00 offset>",
      "turns": [
        { "role": "caseworker", "text": "...", "offset_seconds": 0 },
        { "role": "client", "text": "...", "offset_seconds": 12 },
        ...
      ]
    }
  ]
}

No prose outside the JSON. No markdown fences.`;

export const buildIntakeUserPrompt = (count: number, seed: number, todayISO: string) =>
  `Generate ${count} synthetic shelter-intake conversation transcripts.

Today's date is ${todayISO}. The "started_at" timestamps should fall in the
past 30 days (roughly business hours, US Central Time).

Variation seed: ${seed}. Use this to add variety to presenting issues,
household compositions, and tone across the batch. Not strictly
deterministic — just a stylistic hint.

Return a single JSON object: { "intakes": [...] }.`;

export const IntakeTurnSchema = z.object({
  role: z.enum(['caseworker', 'client']),
  text: z.string().min(1),
  offset_seconds: z.number().int().nonnegative(),
});

export const IntakeSchema = z.object({
  intake_id: z.string().startsWith('SYN-INT-'),
  presenting_issue: z.string(),
  urgency: z.enum(['same_night', 'within_7_days', 'exploring']),
  client_pseudonym: z.string(),
  household_composition: z.string(),
  started_at: z.string(),
  turns: z.array(IntakeTurnSchema).min(8).max(30),
});

export const IntakeBatchSchema = z.object({
  intakes: z.array(IntakeSchema),
});

export type SyntheticIntakeTurn = z.infer<typeof IntakeTurnSchema>;
export type SyntheticIntake = z.infer<typeof IntakeSchema>;
