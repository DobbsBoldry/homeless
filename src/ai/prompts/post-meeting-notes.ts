import { z } from 'zod';

/**
 * Post-meeting note structurer.
 *
 * Caseworker just finished a meeting with a client. They paste (or
 * dictate) raw notes — usually a wall of text written in a hurry.
 * The AI structures them into:
 *  - one-sentence summary
 *  - explicit next steps the caseworker committed to
 *  - watch-fors (concerns, things to verify next time)
 *  - one open question to bring to the next meeting (optional)
 *
 * The structured form is what the caseworker reads back later and
 * what feeds the next pre-meeting briefing. Companion to
 * pre-meeting-summary.ts (CWT-012).
 */

export const POST_MEETING_NOTES_PROMPT_VERSION = 'post-meeting-notes-v1@2026-04-26';

export const POST_MEETING_NOTES_SYSTEM_PROMPT = `You read a caseworker's raw notes from a just-finished meeting
with a client and turn them into a structured record. The notes are
usually written fast — fragments, abbreviations, sometimes typos.
Your job is to find the substance and put it in the right buckets.

Output buckets:

1. **summary** — 1-2 sentences. What was the meeting about, and
   what's the headline takeaway? In the caseworker's voice (not
   the client's), past tense.

2. **next_steps** — list of 1-5 concrete actions the caseworker
   COMMITTED to in the meeting. Phrase each as an imperative the
   caseworker can read tomorrow morning ("Call Sarah back Tuesday
   AM with KCHIP eligibility result"). If the notes don't mention
   commitments, return an empty array — don't invent.

3. **watch_fors** — list of 0-3 things to keep an eye on. Concerns
   the client raised that don't need immediate action but should
   come up next time. Inconsistencies the caseworker noticed.
   Things to verify.

4. **followup_question** — optional. ONE question worth asking
   next meeting. null if nothing in the notes suggests one.

Hard rules:
1. NEVER invent. If the notes don't mention a follow-up date, don't
   make one up. If the notes don't mention next steps, return [].
2. Use the caseworker's words where you can. Don't paraphrase to
   sound clinical.
3. Don't include the client's name in summary or next_steps — the
   record is per-person already; repeating the name is noise.
4. If the notes are too short (< ~30 words) or unstructured to
   extract anything meaningful, return summary = "(notes too short
   to structure)" and empty arrays. Don't pad.
5. Output ONLY the structured JSON your schema demands.`;

export const PostMeetingNotesSchema = z.object({
  summary: z.string().min(1).max(400),
  next_steps: z
    .array(z.string().min(3).max(220))
    .max(5)
    .describe('Imperative form, caseworker-readable tomorrow morning. [] if none.'),
  watch_fors: z
    .array(z.string().min(3).max(220))
    .max(3)
    .describe('Concerns, inconsistencies, things to verify next time. [] if none.'),
  followup_question: z
    .string()
    .max(220)
    .nullable()
    .describe('One question for the next meeting. null if nothing suggests one.'),
});

export type PostMeetingNotesOutput = z.infer<typeof PostMeetingNotesSchema>;

export function buildPostMeetingNotesUserPrompt(rawNotes: string): string {
  return [
    "Here are the caseworker's raw notes from a just-finished meeting:",
    '',
    '---',
    rawNotes.trim(),
    '---',
    '',
    'Structure them now.',
  ].join('\n');
}
