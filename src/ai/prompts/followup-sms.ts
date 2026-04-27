/**
 * Follow-up SMS draft prompt.
 *
 * Caseworker is on the unified person view, just read the
 * pre-meeting briefing, and wants to send the client a short SMS
 * (reminder, check-in, doc nudge). The AI sees the same coalition
 * activity the briefing sees plus a free-text "purpose" the
 * caseworker types ("remind about Friday 2pm, bring SNAP recert").
 * Output: 1-2 sentences, signed with the caseworker's first name
 * and partner-org abbreviation as a placeholder.
 *
 * The caseworker edits before sending. The platform doesn't send
 * the SMS itself today — the caseworker pastes into Twilio/Front/
 * Google Voice/whatever they actually use.
 */

import type { PersonProfileDelta } from '@/db/queries/person-profile';

export const FOLLOWUP_SMS_PROMPT_VERSION = 'followup-sms-v1@2026-04-26';

export const FOLLOWUP_SMS_SYSTEM_PROMPT = `You draft short SMS messages for a caseworker to send to a client
they're working with on housing-related services in Daviess County,
Kentucky. The caseworker tells you the purpose of the message in
their own words; you draft from that plus the recent coalition
activity they've shown you.

Voice and constraints:
- Friendly but not overfamiliar. The caseworker and client likely
  know each other but aren't friends. No "Hey friend!", no emoji
  unless the purpose explicitly asks for one.
- Plain English, 6th-grade reading level. Short sentences.
- 1-2 sentences total. Hard cap: 320 characters (so it fits in a
  2-segment SMS for safety; many carriers split at 153 chars but a
  2-segment message reads fine).
- Sign with the placeholder \`— [name]\`. The caseworker fills in
  their first name before sending.
- If the purpose mentions a specific time/day, include it verbatim.
  Don't paraphrase "Friday" to "the end of the week".

Hard rules:
1. NEVER invent facts the caseworker didn't tell you. If they said
   "remind about Friday", don't decide a time. If they said
   "remind about the meeting", don't decide a day.
2. Don't reference the synthetic_person_ref or any platform jargon
   (no "your case", "your file", "the system"). The client is a
   person, not a row.
3. Don't promise outcomes ("we'll get you SNAP", "you'll be fine").
   Soft language: "we'll work through it", "let's talk about it".
4. If the purpose is a check-in with no specific ask, the message
   should be open: "Just checking in — let me know how things are
   going."
5. If the purpose mentions DV, safety, or a sensitive topic, default
   to vague language. Don't put specifics in an SMS — those can be
   read by anyone in the household.

Output: ONLY the SMS body. No preamble like "Here's a draft:". No
quotes around the text. Just the message the caseworker will edit
and send.`;

export type FollowupSmsInputs = {
  syntheticPersonRef: string;
  purpose: string;
  delta: PersonProfileDelta;
};

export function buildFollowupSmsUserPrompt(inputs: FollowupSmsInputs): string {
  const lines: string[] = [
    `Caseworker's purpose: ${inputs.purpose}`,
    '',
    `Synthetic person ref: ${inputs.syntheticPersonRef}`,
    `Lookback window: since ${inputs.delta.since.toISOString().slice(0, 10)}`,
    '',
  ];

  if (inputs.delta.serviceEvents.length > 0) {
    lines.push('## Recent service events');
    for (const e of inputs.delta.serviceEvents) {
      const at = new Date(e.eventAt).toISOString().slice(0, 10);
      const noteFrag = e.notes ? ` — ${e.notes}` : '';
      lines.push(`- ${at} · ${e.partnerOrgName} · ${e.eventType}${noteFrag}`);
    }
    lines.push('');
  }

  if (inputs.delta.newIntakes.length > 0) {
    lines.push('## Recent intakes');
    for (const i of inputs.delta.newIntakes) {
      const at = new Date(i.createdAt).toISOString().slice(0, 10);
      const profile = i.extractedProfile as Record<string, unknown> | null;
      const presenting =
        profile && typeof profile.presenting_issue === 'string' ? profile.presenting_issue : null;
      const topNeeds =
        profile && Array.isArray(profile.top_needs) ? profile.top_needs.join(', ') : null;
      lines.push(
        `- ${at} · ${i.label}${presenting ? ` · ${presenting}` : ''}${
          topNeeds ? ` · top needs: ${topNeeds}` : ''
        }`,
      );
    }
    lines.push('');
  }

  if (
    inputs.delta.serviceEvents.length === 0 &&
    inputs.delta.newIntakes.length === 0 &&
    inputs.delta.newConsentGrants.length === 0 &&
    inputs.delta.newConsentRevocations.length === 0
  ) {
    lines.push('## No recent activity in the lookback window.');
    lines.push('');
  }

  lines.push('Draft the SMS now.');
  return lines.join('\n');
}
