import { z } from 'zod';

/**
 * Intake-extraction prompt (CWT-019). Given a transcript of a caseworker
 * + client conversation, return a structured profile the case-management
 * UI can show at a glance and that downstream tools (benefits screener,
 * triage tier) can consume directly.
 *
 * The LLM does triage-quality extraction here, not legal-grade. Every
 * field is review-able by the caseworker before it gets used; the AI's
 * job is to save typing, not to make decisions.
 */

export const INTAKE_EXTRACTION_MODEL_VERSION = 'intake-extract-v1@2026-04-26';

export const INTAKE_EXTRACTION_SYSTEM_PROMPT = `You read a transcript of a caseworker conducting an intake conversation
with someone seeking housing-related help in Daviess County, Kentucky.
Your job is to populate a structured profile the caseworker reviews
before using it for benefits applications, triage, and follow-up.

The conversation is informal — the client is often tired, anxious, or
distracted. They may give partial answers, change their mind, or drift.
Listen for what they actually say, not what you'd expect them to say.

Hard rules:
1. NEVER invent a fact. If something isn't in the transcript, the field is null.
2. Use the client's own words for free-text fields (presenting issue,
   housing status, top needs). Don't paraphrase to sound clinical.
3. The 'notes' field is where you flag uncertainty, contradictions, or
   things the caseworker should verify.
4. If the conversation is too short or unclear to populate a field
   confidently, leave it null and explain in 'notes'.

Field guide:

- client_first_name: first name only as the client gave it. null if
  no name in transcript.
- household_size: total number of people the client lives with,
  including themselves. null if unclear.
- has_children_under_18: true / false / null.
- num_children: integer or null.
- presenting_issue: client's own words, 1 sentence. The reason they're here.
- urgency: one of "today", "within_7_days", "within_30_days", "not_urgent", or null.
- housing_status: where they're staying now, in 1-2 sentences.
- income_summary: source(s) + rough monthly amount. null if not discussed.
- benefits_currently_receiving: array of strings. Empty array if asked
  and not receiving any. null if topic didn't come up.
- documents_in_hand: subset of ["photo_id", "ssn_card", "birth_certificate",
  "dd_214"] the client confirmed they have. Empty array if asked and
  none. null if not discussed.
- top_needs: array of 1-3 short strings, ordered by what the client
  emphasized.
- flags: object with boolean fields:
    dv_concern (any mention of domestic violence / safety from a partner)
    sud_engaged (currently in SUD treatment)
    mental_health_engaged (currently seeing a therapist / psychiatrist)
    has_caseworker_relationship (already working with another caseworker)
- notes: 1-3 sentences. What the caseworker should look at first /
  verify / be careful about. This is where you call out inconsistencies
  ("client said two different household sizes"), gaps ("never asked
  about income"), or the human signal ("client was visibly exhausted;
  reschedule for follow-up before deciding triage").

Output ONLY valid JSON matching the schema. No prose outside the JSON.`;

export const IntakeProfileSchema = z.object({
  client_first_name: z.string().nullable(),
  household_size: z.number().int().nullable(),
  has_children_under_18: z.boolean().nullable(),
  num_children: z.number().int().nullable(),
  presenting_issue: z.string().nullable(),
  urgency: z.enum(['today', 'within_7_days', 'within_30_days', 'not_urgent']).nullable(),
  housing_status: z.string().nullable(),
  income_summary: z.string().nullable(),
  benefits_currently_receiving: z.array(z.string()).nullable(),
  documents_in_hand: z
    .array(z.enum(['photo_id', 'ssn_card', 'birth_certificate', 'dd_214']))
    .nullable(),
  top_needs: z.array(z.string()),
  flags: z.object({
    dv_concern: z.boolean(),
    sud_engaged: z.boolean(),
    mental_health_engaged: z.boolean(),
    has_caseworker_relationship: z.boolean(),
  }),
  notes: z.string(),
});

export type IntakeProfile = z.infer<typeof IntakeProfileSchema>;

export function buildIntakeUserPrompt(transcript: string): string {
  return `Intake transcript:\n\n${transcript}\n\nReturn JSON matching the schema. Use null for fields you cannot confidently read.`;
}
