/**
 * Steering committee agenda drafter.
 *
 * Coordinator about to chair a steering meeting opens this and asks
 * Claude to draft an agenda based on (a) the prior meeting's open
 * action items, and (b) recent coalition activity (the same digest
 * the weekly insights brief uses). Output is short markdown the
 * coordinator pastes into the agenda field of the meeting record.
 */

import type { CoalitionWeeklyDigest } from '@/db/queries/coalition-weekly-digest';
import type { SteeringMeeting } from '@/db/schema/steering-meetings';

export const STEERING_AGENDA_PROMPT_VERSION = 'steering-agenda-v1@2026-04-26';

export const STEERING_AGENDA_SYSTEM_PROMPT = `You draft a steering committee agenda for a Daviess County
homelessness coalition. The coordinator chairs the meeting; the
agenda runs ~45 minutes. Your job is to surface what actually needs
the steering committee's attention this meeting.

You see two inputs:
1. The most recent posted meeting's action items + decisions
   (unfinished business is the strongest signal).
2. A coalition activity digest (volume counts + cross-org
   touchpoints + action-blocked queues + recent high-risk filings).

Write the agenda as Markdown. Structure:

## Open from last meeting
- 1-3 bullets pulled from the prior action items. If an item looks
  like it's already done based on the new digest (e.g. "draft a
  packet for case X" and the digest shows packets are caught up),
  say so explicitly and propose closing it. If there's no prior
  meeting or no action items, write "_No prior action items to
  carry forward._" and skip the section.

## What changed since last meeting
- 2-4 bullets from the digest. Lead with what most needs
  steering's attention: cross-org pattern, action-blocked queue
  growth, consent revocations spike, etc. Pure number recitations
  don't belong here — pick the signal.

## Decisions to make today
- 1-3 specific decisions the committee should resolve today.
  Examples: "Approve KLA capacity ask", "Decide whether to expand
  the cross-org touch threshold from 2 to 3 partners". Phrase as
  decision questions, not problem statements.

## Standing items
- 2 fixed bullets: "Coordinator update (5 min)" and "Partner
  round-robin (10 min)".

Hard rules:
1. NEVER invent action items. Only carry forward items present in
   the prior meeting's text.
2. NEVER invent counts. The digest counts are the only counts.
3. If the digest is mostly empty (everything 0 or near it), write
   a much shorter agenda ("Quiet window — light agenda") rather
   than padding.
4. Keep it short — under 200 words total. Steering's time matters.
5. Output ONLY the Markdown. No preamble like "Here's the agenda:".`;

export type SteeringAgendaInputs = {
  meetingTitle: string;
  meetingHeldOn: string;
  priorMeeting: SteeringMeeting | null;
  digest: CoalitionWeeklyDigest;
};

export function buildSteeringAgendaUserPrompt(inputs: SteeringAgendaInputs): string {
  const lines: string[] = [`Meeting: ${inputs.meetingTitle}`, `Date: ${inputs.meetingHeldOn}`, ''];

  if (inputs.priorMeeting) {
    lines.push(`## Prior meeting (${inputs.priorMeeting.heldOn}): "${inputs.priorMeeting.title}"`);
    lines.push('');
    lines.push('### Action items (verbatim from the prior minutes)');
    lines.push(inputs.priorMeeting.actionItemsMd.trim() || '_(none recorded)_');
    lines.push('');
    lines.push('### Decisions');
    lines.push(inputs.priorMeeting.decisionsMd.trim() || '_(none recorded)_');
    lines.push('');
  } else {
    lines.push('## Prior meeting: none on file (this is the first or earliest meeting).');
    lines.push('');
  }

  lines.push('## Coalition activity digest');
  lines.push(
    `Window: last ${inputs.digest.windowDays} days (since ${inputs.digest.since.toISOString().slice(0, 10)})`,
  );
  lines.push('');
  lines.push('Volume:');
  lines.push(`- New filings: ${inputs.digest.newFilings}`);
  lines.push(`- New intakes: ${inputs.digest.newIntakes}`);
  lines.push(`- New service events: ${inputs.digest.newServiceEvents}`);
  lines.push(`- New consent grants: ${inputs.digest.newConsentGrants}`);
  lines.push(`- New consent revocations: ${inputs.digest.newConsentRevocations}`);
  lines.push('');
  lines.push('Action-blocked:');
  lines.push(`- Urgent extracted intakes: ${inputs.digest.urgentExtractedIntakes}`);
  lines.push(`- High-risk filings without packet: ${inputs.digest.highScoreFilingsNoPacket}`);
  lines.push('');
  lines.push(`Cross-org touchpoints (≥2 partners): ${inputs.digest.crossOrgTouchpoints.length}`);
  for (const p of inputs.digest.crossOrgTouchpoints) {
    lines.push(`- ${p.uniqueOrgs} partners · ${p.totalEvents} events · ${p.orgNames.join(', ')}`);
  }
  lines.push('');

  if (inputs.digest.recentHighRiskFilings.length > 0) {
    lines.push('Recent high-risk filings:');
    for (const f of inputs.digest.recentHighRiskFilings) {
      lines.push(`- ${f.caseNumber} score ${f.score}, packet=${f.packetStatus ?? 'none'}`);
    }
    lines.push('');
  }

  lines.push('Draft the agenda now.');
  return lines.join('\n');
}
