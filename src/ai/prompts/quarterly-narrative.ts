/**
 * Quarterly narrative prompt.
 *
 * Coalition coordinator opens the public quarterly outcomes page
 * and clicks "Draft narrative". Claude reads the same suppression-
 * safe aggregates that drive the structured numbers + the Fiscal
 * Court brief, and writes a 3-4 paragraph plain-English summary
 * suitable for a community newsletter, Fiscal Court appendix, or
 * partner-org email update.
 *
 * Output is prose, not numbers. The page already has the numbers.
 * This is the "what does it mean" companion.
 */

import type {
  CoalitionAggregate,
  GovernanceCountsForQuarter,
  Quarter,
  QuarterlyEvictionAggregate,
} from '@/db/queries/public-outcomes';

export const QUARTERLY_NARRATIVE_PROMPT_VERSION = 'quarterly-narrative-v1@2026-04-26';

export const QUARTERLY_NARRATIVE_SYSTEM_PROMPT = `You write a 3-4 paragraph public-facing narrative summarizing
one quarter of the Daviess County homelessness coalition's
outcomes. The audience is the Fiscal Court, the Steering
Committee, partner orgs, and an interested public — read aloud at
a community meeting kind of voice.

Structure (no headers, just paragraphs):

PARAGRAPH 1 — eviction defense.
Lead with the household-impact headline. How many filings did
KLA reach with a drafted-and-reviewed response? What did the
default-judgment number look like — the metric we're trying to
pull down? If counts are suppressed (the input shows them as
'fewer than 5'), say so plainly; don't invent a number.

PARAGRAPH 2 — coalition reach.
The partner count, the shelter capacity, and the rolling-90-day
service events. The 90-day window is wider than the quarter on
purpose: it shows the coalition's working memory, not just the
quarter's churn.

PARAGRAPH 3 — governance.
Consent grants, revocations, and access-log volume. The framing
is "we did this with consent and a paper trail" — that's the
point of the data trust.

PARAGRAPH 4 (optional) — what's next.
1-2 sentences on what the coordinator wants stakeholders to know
heading into next quarter. If nothing changed materially, you can
omit this paragraph.

Hard rules:
1. NEVER invent a count. The numbers in the input are the only
   numbers you have. Suppressed (null) means "fewer than 5";
   write that out, don't approximate.
2. Don't editorialize beyond what the numbers support. Don't say
   "great progress" if the numbers don't show it.
3. Don't reference individual people, filings, or partners by
   name. The transparency report deliberately operates at the
   aggregate.
4. Plain English, 8th-grade reading level. No legal jargon.
5. Output ONLY the prose. No headers, no bullets, no preamble.`;

const fmtCount = (n: number | null): string => (n === null ? 'fewer than 5' : n.toLocaleString());

const fmtPct = (a: number | null, b: number | null): string => {
  if (a === null || b === null || b === 0) return 'unavailable';
  return `${Math.round((a / b) * 100)}%`;
};

export function buildQuarterlyNarrativeUserPrompt(input: {
  quarter: Quarter;
  evictionForQuarter: QuarterlyEvictionAggregate;
  coalitionSnapshot: CoalitionAggregate;
  governanceForQuarter: GovernanceCountsForQuarter;
}): string {
  const { quarter, evictionForQuarter, coalitionSnapshot, governanceForQuarter } = input;
  const repRate = fmtPct(evictionForQuarter.filingsWithPacket, evictionForQuarter.filingsIngested);

  const lines = [
    `Quarter: ${quarter.label}`,
    '',
    '## Eviction defense',
    `- Filings ingested: ${fmtCount(evictionForQuarter.filingsIngested)}`,
    `- Filings with attorney-reviewed response packet: ${fmtCount(evictionForQuarter.filingsWithPacket)}`,
    `- Outcomes recorded: ${fmtCount(evictionForQuarter.outcomesRecorded)}`,
    `- Default-judgment outcomes: ${fmtCount(evictionForQuarter.defaultJudgments)}`,
    `- Packet representation rate (packets / filings): ${repRate}`,
    '',
    '## Coalition (rolling 90 days)',
    `- Active partner orgs: ${coalitionSnapshot.partnerCount}`,
    `- Partners actively sharing data: ${coalitionSnapshot.partnersSharing}`,
    `- Active shelters: ${coalitionSnapshot.shelterCount}`,
    `- Total shelter capacity: ${coalitionSnapshot.totalShelterCapacity}`,
    `- Service events in window: ${fmtCount(coalitionSnapshot.serviceEventsRolling)}`,
    `- Unique people touched: ${fmtCount(coalitionSnapshot.uniquePeopleRolling)}`,
    '',
    '## Governance',
    `- Consent grants this quarter: ${fmtCount(governanceForQuarter.consentGrants)}`,
    `- Consent revocations this quarter: ${fmtCount(governanceForQuarter.consentRevocations)}`,
    `- Data-access events this quarter: ${fmtCount(governanceForQuarter.dataAccessEvents)}`,
    '',
    'Write the narrative now.',
  ];
  return lines.join('\n');
}
