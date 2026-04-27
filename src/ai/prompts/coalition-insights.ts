/**
 * Coalition weekly insights prompt.
 *
 * Coordinator (admin / steering committee) opens this view at the
 * start of the week and gets a 3-paragraph summary of what's
 * happening across the coalition: volume, patterns, who's at risk,
 * where action is stuck. Plain prose, no headers — they read it
 * in 60 seconds.
 *
 * The AI sees aggregate counts, top patterns (cross-org, high-risk
 * filings without packets), and a sample of recent activity. It
 * does NOT see individual identities — synthetic person refs are
 * opaque, and the recipient (coordinator) is the right audience for
 * coalition-level patterns, not per-person detail.
 */

import type { CoalitionWeeklyDigest } from '@/db/queries/coalition-weekly-digest';

export const COALITION_INSIGHTS_PROMPT_VERSION = 'coalition-insights-v1@2026-04-26';

export const COALITION_INSIGHTS_SYSTEM_PROMPT = `You write a short weekly insights brief for a Daviess County
homelessness coalition coordinator. The coordinator opens this on
Monday morning and reads it in under 60 seconds. The point is to
surface what changed, what's stuck, and what they should ask about
in the next steering meeting.

Write 3 short paragraphs (~120 words total):

PARAGRAPH 1 — pulse.
Lead with the volume signal: how does activity this window compare
to a typical week? If counts are low, say so plainly ("quiet week
— 3 new filings"). If high, name what's driving it ("12 new filings,
mostly Plaintiff X — third week in a row").

PARAGRAPH 2 — patterns / at-risk.
What's the most coalition-relevant pattern? Examples:
- Cross-org touchpoints — people hitting 3+ partners are the cases
  that prove the platform's value; lead with those if any.
- High-score filings without packets — the action-blocked queue
  the coordinator can clear by talking to KLA.
- Urgent extracted intakes — caseworker-side time pressure.
Don't list everything — pick the one or two that most need a human
decision this week.

PARAGRAPH 3 — what to ask.
1-2 specific questions for the steering meeting. Examples:
- "Is KLA capacity the constraint? 8 high-score filings without
  packets is twice last week."
- "Why did consent revocations double? Worth a quick word with
  the partner who's losing them."
- "Quiet week, but the cross-org count is up 30% — proof the
  platform is doing what we built it for."

Hard rules:
1. NEVER invent numbers. The counts you have are the counts you
   have. If a count is 0, don't suggest a trend.
2. Don't reference individual synthetic_person_refs. The coordinator
   doesn't read per-person specifics in this view; that's caseworker
   territory.
3. If the window is empty (everything = 0), say so in one line and
   stop. Don't pad.
4. No emoji. No headers. Just three paragraphs.

Output: plain text. The UI renders it verbatim.`;

const fmtDate = (d: Date) => d.toISOString().slice(0, 10);

export function buildCoalitionInsightsUserPrompt(digest: CoalitionWeeklyDigest): string {
  const lines: string[] = [
    `Today: ${fmtDate(new Date())}`,
    `Window: last ${digest.windowDays} day${digest.windowDays === 1 ? '' : 's'} (since ${fmtDate(digest.since)})`,
    '',
    '## Volume counts',
    `- New eviction filings: ${digest.newFilings}`,
    `- New intakes: ${digest.newIntakes}`,
    `- New service events: ${digest.newServiceEvents}`,
    `- New consent grants: ${digest.newConsentGrants}`,
    `- New consent revocations: ${digest.newConsentRevocations}`,
    '',
    '## Action-blocked queues',
    `- Urgent extracted intakes (today / within_7_days): ${digest.urgentExtractedIntakes}`,
    `- High-risk open filings without a response packet drafted: ${digest.highScoreFilingsNoPacket}`,
    '',
  ];

  if (digest.crossOrgTouchpoints.length > 0) {
    lines.push(`## Cross-org touchpoints (${digest.crossOrgTouchpoints.length})`);
    for (const p of digest.crossOrgTouchpoints) {
      lines.push(
        `- ${p.uniqueOrgs} partners · ${p.totalEvents} events · ${p.orgNames.join(', ')}`,
      );
    }
    lines.push('');
  } else {
    lines.push('## Cross-org touchpoints: (none)');
    lines.push('');
  }

  if (digest.recentHighRiskFilings.length > 0) {
    lines.push(`## Recent high-risk filings (top ${digest.recentHighRiskFilings.length})`);
    for (const f of digest.recentHighRiskFilings) {
      lines.push(
        `- ${f.caseNumber} · ${f.plaintiff} · score ${f.score} · packet=${f.packetStatus ?? 'none'}`,
      );
    }
    lines.push('');
  }

  if (digest.topPartnerEventTypes.length > 0) {
    lines.push('## Top partner activity by event type');
    for (const t of digest.topPartnerEventTypes) {
      lines.push(`- ${t.partnerOrgName} · ${t.eventType} · ${t.count}`);
    }
    lines.push('');
  }

  lines.push('Write the brief now.');
  return lines.join('\n');
}
