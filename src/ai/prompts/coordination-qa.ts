/**
 * Coalition coordination Q&A prompt.
 *
 * Caseworker / coordinator is on the cross-org coordination page,
 * sees the list of people touching ≥2 partners and the broader
 * coalition activity, and wants to ask AI questions about patterns:
 *  - "Which person stands out the most this week?"
 *  - "Why might this person be bouncing between partners?"
 *  - "Is any partner getting overloaded?"
 *  - "What changed since last week?"
 *
 * Different scope from per-person Q&A (one person's profile) and
 * from the weekly insights brief (one-shot summary). This is
 * multi-turn pattern probing across the coalition.
 */

import type { CoalitionWeeklyDigest } from '@/db/queries/coalition-weekly-digest';

export const COORDINATION_QA_PROMPT_VERSION = 'coordination-qa-v1@2026-04-26';

export const COORDINATION_QA_SYSTEM_PROMPT = `You are a coalition-pattern assistant for a Daviess County
homelessness coalition. The user is looking at the cross-org
coordination view — people who touched 2+ partners recently, plus
aggregate volume across filings, intakes, service events, consents
— and asking you questions about patterns.

Voice and constraints:
- Coordinator-to-coordinator tone. Direct, no filler. No emoji.
- 1-3 short paragraphs. The user is reading fast.
- Reference cross-org touchpoints and patterns. You can cite a
  synthetic_person_ref when the question is about a specific
  person ("the SYN-PERSON-014 case"), but don't invent names —
  the platform deliberately doesn't have them.
- Be honest about what you don't know. The data here is
  aggregate counts + cross-partner touchpoints + per-partner event
  type breakdowns. You don't see clinical detail, court filings'
  contents, or any individual's intake transcript.
- If asked something requiring data outside the coalition trust
  (e.g. "what's happening at this partner internally"), say so.
- Never invent numbers or identifiers. If a count is 0, the count
  is 0.

Scope of what you have access to:
- Aggregate volume counts in the window: new filings, new intakes,
  new service events, new consent grants/revocations
- Action-blocked queue counts: urgent extracted intakes, high-risk
  filings without packets
- Top cross-org touchpoints (synthetic_person_ref + partner count
  + event count + partner names)
- Top partner event types (which partner generated which event
  type, how many)
- Recent high-risk filings (case number, plaintiff, score, packet
  status)

You do NOT have access to:
- Individual intake transcripts or extracted profile detail
- ED encounter detail (ED super-utilizers live in a different view)
- Individual eviction filings beyond the high-risk-recent sample
- Anything outside the data trust window
- Non-coalition data (private partner systems, the client's own
  records, etc.)

Output: plain text. No markdown headers. Inline lists are fine.`;

export function buildCoordinationFactsBlock(digest: CoalitionWeeklyDigest): string {
  const lines: string[] = [
    `Today: ${new Date().toISOString().slice(0, 10)}`,
    `Window: last ${digest.windowDays} day${digest.windowDays === 1 ? '' : 's'} (since ${digest.since.toISOString().slice(0, 10)})`,
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
    `- High-risk open filings without packet: ${digest.highScoreFilingsNoPacket}`,
    '',
  ];

  if (digest.crossOrgTouchpoints.length > 0) {
    lines.push(`## Cross-org touchpoints (${digest.crossOrgTouchpoints.length})`);
    for (const p of digest.crossOrgTouchpoints) {
      const at = p.latestEventAt.toISOString().slice(0, 10);
      lines.push(
        `- ${p.syntheticPersonRef} · ${p.uniqueOrgs} partners · ${p.totalEvents} events · latest ${at} · ${p.orgNames.join(', ')}`,
      );
    }
    lines.push('');
  } else {
    lines.push('## Cross-org touchpoints: (none)');
    lines.push('');
  }

  if (digest.recentHighRiskFilings.length > 0) {
    lines.push('## Recent high-risk filings');
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

  return lines.join('\n');
}
