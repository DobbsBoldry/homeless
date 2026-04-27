import { z } from 'zod';
import type { TriageCandidate } from '@/db/queries/attorney-triage';

/**
 * Attorney morning-triage prompt.
 *
 * Input: ~20 open eviction cases with risk scores and current state
 * (packet drafted? filed? outcome recorded?). Output: a ranked list
 * of 3-5 cases the attorney should focus on today, with one short
 * sentence per case explaining why.
 *
 * The job is NOT to repeat the risk score. The job is to think like
 * a triage nurse: what's most time-sensitive, where is action
 * blocked, where is the highest-impact-per-minute work?
 */

export const ATTORNEY_TRIAGE_PROMPT_VERSION = 'attorney-triage-v1@2026-04-26';

export const ATTORNEY_TRIAGE_SYSTEM_PROMPT = `You are the morning triage assistant for a Kentucky Legal Aid (KLA)
attorney handling eviction defense in Daviess County. The attorney
opens this view at 9am and gets ~30 seconds to plan their day.

Input: a list of open eviction cases (status filed or served, last
~30 days), each with risk score, packet draft state, and outcome
state.

Output: 3 to 5 cases ranked by what the attorney should work on
FIRST today. For each pick, write one sentence (under 25 words)
explaining the rationale. Plain English. No legal jargon.

How to think about ranking:

1. **Time pressure beats risk score.** A served filing with no
   packet drafted and a high amount claimed is more urgent than a
   high-risk filing that's already been answered.
2. **Action-blocking gaps go first.** "No packet drafted yet" or
   "no risk score yet" is high triage value — the attorney can
   unblock it in one click.
3. **High score + no movement** is your bread and butter. These are
   the cases with the most upside if KLA gets involved.
4. **Don't pick already-handled cases.** If a case has an approved
   or filed packet AND an outcome recorded, it's done — don't
   surface it.
5. **Don't pad to 5.** If only 3 cases deserve attention, return 3.
   If only 1 does, return 1.

Reasoning style for each pick:
- Lead with WHY this one. Examples:
  - "Served 4 days ago, $3,400 claimed, no packet drafted — answer
    deadline is the tightest in the docket."
  - "Risk score 87 with no movement; this is the highest-leverage
    case where KLA hasn't started yet."
  - "Score is mid but it's a holdover with no rent owed — likely
    fast win once the answer is filed."
- Don't restate the case number or dollar amount in the rationale —
  the UI shows those next to the rationale.

Hard rules:
- Reference cases ONLY by their filing_id from the input. Do not
  invent ids.
- Do not invent facts about the case (defendant name, court date,
  etc.) that aren't in the input.
- Output ONLY the structured JSON your schema demands.`;

export const AttorneyTriageItemSchema = z.object({
  filing_id: z.string().uuid(),
  priority_rank: z.number().int().min(1).max(5),
  rationale: z
    .string()
    .min(10)
    .max(220)
    .describe('One sentence under 25 words explaining why this case ranks here.'),
});

export const AttorneyTriageOutputSchema = z.object({
  picks: z
    .array(AttorneyTriageItemSchema)
    .min(1)
    .max(5)
    .describe('Up to 5 cases ranked by today-priority. Order matters; do not pad.'),
  overall_note: z
    .string()
    .max(200)
    .nullable()
    .describe(
      'Optional one-sentence overview of the docket today (e.g. "Quiet morning — only 2 cases need attention"). Null if nothing to say.',
    ),
});

export type AttorneyTriageOutput = z.infer<typeof AttorneyTriageOutputSchema>;

export function buildAttorneyTriageUserPrompt(candidates: TriageCandidate[]): string {
  const lines: string[] = [
    'Here is the list of open eviction cases. Pick the top 3-5 to focus on first today.',
    '',
    `Today's date: ${new Date().toISOString().slice(0, 10)}`,
    `Candidate count: ${candidates.length}`,
    '',
  ];

  for (const c of candidates) {
    const filed = c.filing.filedAt.toISOString().slice(0, 10);
    const amount =
      c.filing.amountClaimedCents != null
        ? `$${(c.filing.amountClaimedCents / 100).toFixed(2)}`
        : 'unknown';
    const score = c.score != null ? String(c.score) : 'unscored';
    const packet = c.packetStatus ?? 'no packet drafted';
    const outcome = c.hasOutcome ? 'outcome recorded' : 'no outcome yet';
    lines.push(
      `- filing_id=${c.filing.id} · case=${c.filing.caseNumber} · status=${c.filing.status} ` +
        `· cause=${c.filing.causeType} · filed=${filed} · amount=${amount} ` +
        `· risk_score=${score} · packet=${packet} · ${outcome}`,
    );
  }

  lines.push('');
  lines.push('Return the structured triage list now.');
  return lines.join('\n');
}
