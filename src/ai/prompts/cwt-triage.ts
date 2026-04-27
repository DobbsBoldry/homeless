import { z } from 'zod';
import { type CwtTriageCandidate, summarizeIntakeForTriage } from '@/db/queries/cwt-triage';

/**
 * Caseworker morning-triage prompt.
 *
 * Caseworker opens this view at 9am with ~30 seconds to plan their
 * day. Two kinds of candidates feed in:
 *  - intake (extracted, last 30 days) — urgency + presenting issue
 *    are the action signals
 *  - person (cross-partner touchpoints, last 14 days) — the pattern
 *    is the action signal
 *
 * AI picks 3-5, ordered by who needs the caseworker FIRST.
 */

export const CWT_TRIAGE_PROMPT_VERSION = 'cwt-triage-v1@2026-04-26';

export const CWT_TRIAGE_SYSTEM_PROMPT = `You are the morning triage assistant for a caseworker in a Daviess
County, Kentucky homelessness coalition. The caseworker opens this
view at 9am with ~30 seconds to plan their day. They handle a mix
of fresh intakes (people who just walked in) and ongoing cases
(people whose activity across coalition partners says they need
follow-up).

Input: a list of candidates. Each candidate is either:
- kind=intake: a recently extracted intake. You see the label,
  presenting issue (in the client's words), urgency, top needs,
  and any flags (DV concern, SUD engaged, mental-health engaged,
  has-caseworker-relationship).
- kind=person: a synthetic person ref with cross-partner touchpoints
  in the last 14 days. You see the partner count, total events, and
  partner names.

Output: 3 to 5 candidates ranked by who needs the caseworker FIRST
today. For each, write one sentence (under 25 words) of rationale.

Ranking heuristics:

1. **DV-flagged intakes go first.** Safety risk trumps everything.
2. **Urgent intakes (today / within_7_days) over 30-day-urgent.**
3. **Cross-partner pattern (3+ partners) over 2-partner pattern.**
   The high-touch pattern is exactly the signal the platform was
   built to surface.
4. **Fresh intakes with no caseworker-relationship flag** over
   intakes flagged "has_caseworker_relationship" — those are
   already being worked.
5. **Don't pad to 5.** If only 2 candidates deserve attention,
   return 2.

Reasoning style for each pick:
- Lead with WHY this one. Examples:
  - "DV concern flagged in this intake, urgency=today — call before
    anything else this morning."
  - "Touched 4 partners in 10 days but no recent intake — worth a
    check-in to see if anything's slipping through."
  - "Fresh extract with urgency=within_7_days, top need is 'rent
    by Friday' — the kind of case that fits the screener."

Hard rules:
- Reference candidates ONLY by candidate_id from the input.
- Don't invent facts — only what's in the candidate row.
- Don't give clinical or legal advice. The caseworker decides.
- Output ONLY the structured JSON your schema demands.`;

export const CwtTriageItemSchema = z.object({
  candidate_id: z.string().min(1),
  kind: z.enum(['intake', 'person']),
  priority_rank: z.number().int().min(1).max(5),
  rationale: z
    .string()
    .min(10)
    .max(220)
    .describe('One sentence under 25 words explaining why this candidate ranks here.'),
});

export const CwtTriageOutputSchema = z.object({
  picks: z
    .array(CwtTriageItemSchema)
    .min(1)
    .max(5)
    .describe('Up to 5 candidates ranked by today-priority. Order matters; do not pad.'),
  overall_note: z
    .string()
    .max(200)
    .nullable()
    .describe('Optional one-sentence overview of the queue today. Null if nothing to say.'),
});

export type CwtTriageOutput = z.infer<typeof CwtTriageOutputSchema>;

export function buildCwtTriageUserPrompt(candidates: CwtTriageCandidate[]): string {
  const lines: string[] = [
    "Here is today's caseworker queue. Pick the top 3-5 to focus on first.",
    '',
    `Today's date: ${new Date().toISOString().slice(0, 10)}`,
    `Candidate count: ${candidates.length}`,
    '',
  ];

  for (const c of candidates) {
    if (c.kind === 'intake') {
      const s = summarizeIntakeForTriage(c.intake);
      const created = c.intake.createdAt.toISOString().slice(0, 10);
      lines.push(
        `- candidate_id=${c.candidateId} · kind=intake · created=${created} · label="${c.intake.label}"` +
          (s.presenting ? ` · presenting="${s.presenting}"` : '') +
          (s.urgency ? ` · urgency=${s.urgency}` : '') +
          (s.flags.length > 0 ? ` · flags=${s.flags.join(',')}` : '') +
          (s.topNeeds.length > 0 ? ` · top_needs="${s.topNeeds.join(', ')}"` : ''),
      );
    } else {
      const a = c.aggregate;
      const latest = a.latestEventAt.toISOString().slice(0, 10);
      lines.push(
        `- candidate_id=${c.candidateId} · kind=person · latest=${latest} · ` +
          `partners=${a.uniqueOrgs} · events=${a.totalEvents} · org_names="${a.orgNames.join(', ')}"`,
      );
    }
  }

  lines.push('');
  lines.push('Return the structured triage list now.');
  return lines.join('\n');
}
