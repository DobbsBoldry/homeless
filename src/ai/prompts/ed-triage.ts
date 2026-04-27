import { z } from 'zod';
import type { EdTriageCandidate } from '@/db/queries/ed-triage';

/**
 * ED super-utilizer morning-triage prompt.
 *
 * Care coordinator opens this view at 8am, reads it in 30 seconds,
 * and decides who to chart-review or call first. Input: the current
 * super-utilizer queue (≥3 ED visits in 180d + housing instability)
 * with each patient's care-plan status. Output: 3-5 patients ranked,
 * one sentence each.
 *
 * The patient_id is opaque (SYN-PAT-... synthetic, hashed post-BAA).
 * The model sees no PHI — chief complaints stay summarized as the
 * field is, but no name, MRN, or contact info is ever in the prompt.
 */

export const ED_TRIAGE_PROMPT_VERSION = 'ed-triage-v1@2026-04-26';

export const ED_TRIAGE_SYSTEM_PROMPT = `You are the morning triage assistant for a Daviess County ED
super-utilizer care coordinator. The coordinator opens this view at
8am with ~30 seconds to plan the day.

Input: the current super-utilizer queue. Each row is one patient
identified ONLY by an opaque ref (SYN-PAT-...) plus visit count,
housing status, last chief complaint, latest visit timestamp, and
the status of any AI-drafted care plan on file.

Output: 3 to 5 patients ranked by who needs the coordinator's
attention FIRST today. For each pick, write one sentence (under 25
words) explaining the rationale. Plain English. No clinical jargon.

How to think about ranking:

1. **Action-blocked goes first.** A patient with no care plan
   drafted is more triage-urgent than a patient whose plan is
   approved and active.
2. **Recent visit + unsheltered** is higher priority than
   recent visit + doubled-up. The housing exposure matters.
3. **Visit volume matters but doesn't trump action gaps.** A 9-visit
   patient with an active plan can wait if a 4-visit unsheltered
   patient has no plan.
4. **Don't pick patients with archived or active plans** unless the
   visit volume just spiked — those are coordinator-stable.
5. **Don't pad to 5.** If only 3 patients deserve attention today,
   return 3.

Reasoning style:
- Lead with WHY this one. Examples:
  - "Unsheltered, 5 visits in 30 days, no plan drafted — the
    coordinator can unblock this in 10 minutes."
  - "Plan was drafted last month but never approved — worth a quick
    review before re-engaging the patient."
  - "Top of queue by volume (12 visits) but plan is active — not
    urgent today, just a check-in."
- Don't restate the visit count or housing status — the UI shows
  those next to the rationale.

Hard rules:
- Reference patients ONLY by their patient_id from the input. Do
  not invent ids.
- Do not invent clinical facts — only what's in the input.
- Do not give clinical advice. The coordinator decides care.
- Output ONLY the structured JSON your schema demands.`;

export const EdTriageItemSchema = z.object({
  patient_id: z.string().min(1),
  priority_rank: z.number().int().min(1).max(5),
  rationale: z
    .string()
    .min(10)
    .max(220)
    .describe('One sentence under 25 words explaining why this patient ranks here.'),
});

export const EdTriageOutputSchema = z.object({
  picks: z
    .array(EdTriageItemSchema)
    .min(1)
    .max(5)
    .describe('Up to 5 patients ranked by today-priority. Order matters; do not pad.'),
  overall_note: z
    .string()
    .max(200)
    .nullable()
    .describe(
      'Optional one-sentence overview ("Quiet morning — only 2 patients need attention"). Null if nothing to say.',
    ),
});

export type EdTriageOutput = z.infer<typeof EdTriageOutputSchema>;

export function buildEdTriageUserPrompt(candidates: EdTriageCandidate[]): string {
  const lines: string[] = [
    "Here is today's ED super-utilizer queue. Pick the top 3-5 to focus on first.",
    '',
    `Today's date: ${new Date().toISOString().slice(0, 10)}`,
    `Candidate count: ${candidates.length}`,
    '',
  ];

  for (const c of candidates) {
    const latest = c.latestVisitAt.toISOString().slice(0, 10);
    const plan = c.carePlanStatus ?? 'no plan';
    lines.push(
      `- patient_id=${c.patientId} · visits=${c.visitCount} · housing=${c.housingStatus} ` +
        `· last_visit=${latest} · last_complaint="${c.lastChiefComplaint}" · plan=${plan}`,
    );
  }

  lines.push('');
  lines.push('Return the structured triage list now.');
  return lines.join('\n');
}
