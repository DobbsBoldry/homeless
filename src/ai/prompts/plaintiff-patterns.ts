import type { TopPlaintiff } from '@/db/queries/eviction-filings';

/**
 * Plaintiff pattern commentary prompt.
 *
 * The docket page surfaces a deterministic list of "top plaintiffs in
 * the last N days" — purely SQL aggregation on public court records.
 * The AI commentary is the "so what?" — 2-3 sentences in plain English
 * for the coordinator about what the pattern might suggest. Bulk-
 * filing landlords are the canonical signal; same-day mass filings,
 * the same plaintiff every Monday, are others.
 *
 * The AI is told NOT to allege wrongdoing or imagine motives — these
 * are public-record counts; legal interpretation is the attorney's
 * job. The commentary is observational ("X has filed 14 cases in 14
 * days, more than any other plaintiff this month — worth flagging").
 */

export const PLAINTIFF_PATTERNS_PROMPT_VERSION = 'plaintiff-patterns-v1@2026-04-26';

export const PLAINTIFF_PATTERNS_SYSTEM_PROMPT = `You write a short observational commentary on a list of plaintiffs
who have filed multiple eviction cases in the last N days in
Daviess County, Kentucky. The audience is a coalition coordinator
deciding whether to flag a plaintiff to the steering committee or
to KLA's intake team for proactive outreach.

Output: ONE paragraph, 2-4 sentences, ~80 words. Plain English.
No headers. No bullets. No emoji.

How to think about it:
- Lead with the most striking pattern (highest count, or most
  compressed time window).
- If the top plaintiff is far ahead of the rest, say so.
- If filings are clustered in a narrow date range, that's worth
  flagging — bulk filings often mean a property-wide action.
- If the spread is even (similar counts across plaintiffs), say
  there's no standout this window.

Hard rules:
1. NEVER allege wrongdoing or imagine motives. These are public
   counts; you don't know the legal merits.
2. NEVER invent a name or count. Reference plaintiffs only as they
   appear in the input.
3. If the input is empty, say so plainly: "No plaintiff filed three
   or more cases in this window." Then stop.
4. Output ONLY the prose paragraph.`;

export function buildPlaintiffPatternsUserPrompt(input: {
  windowDays: number;
  minCount: number;
  plaintiffs: TopPlaintiff[];
}): string {
  const lines: string[] = [
    `Window: last ${input.windowDays} days.`,
    `Threshold: at least ${input.minCount} filings to appear in the list.`,
    '',
  ];
  if (input.plaintiffs.length === 0) {
    lines.push('No plaintiffs met the threshold this window.');
  } else {
    lines.push(`## Top plaintiffs (${input.plaintiffs.length})`);
    for (const p of input.plaintiffs) {
      const earliest = p.earliest.toISOString().slice(0, 10);
      const latest = p.latest.toISOString().slice(0, 10);
      lines.push(`- "${p.plaintiff}" · ${p.filings} filings · ${earliest} → ${latest}`);
    }
  }
  lines.push('');
  lines.push('Write the commentary now.');
  return lines.join('\n');
}
