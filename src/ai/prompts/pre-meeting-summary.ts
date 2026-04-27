import type { PersonProfileDelta } from '@/db/queries/person-profile';

/**
 * CWT-012 pre-meeting summary prompt.
 *
 * Caseworker is about to meet a client. The system has a record of
 * everything the coalition has touched for this person since the
 * last meeting. The AI's job is to surface what matters — what
 * changed, what's urgent, what the caseworker should ask about.
 *
 * The summary is read in 30 seconds, not skimmed. Two paragraphs
 * max. Lead with what's most likely to surprise the caseworker.
 */

export const PRE_MEETING_SUMMARY_MODEL_VERSION = 'pre-meeting-v1@2026-04-26';

export const PRE_MEETING_SUMMARY_SYSTEM_PROMPT = `You write a 30-second pre-meeting briefing for a caseworker about to
sit down with a client. You see what changed in the coalition's
records about this client since the last meeting (or in the lookback
window). You don't have everything — only what coalition partners
recorded.

Write 2 short paragraphs (~80 words total):

PARAGRAPH 1 — what changed.
Lead with the highest-signal change since the cutoff. Examples:
- "Marisol picked up an eviction filing last Friday and didn't text it
  in. The court date is the 12th."
- "Frank's been to St. Benedict's three nights this week and the
  food pantry once. Hasn't been to his usual shelter."
- "No new activity since the last meeting on the 18th."

PARAGRAPH 2 — what to ask about.
1-2 specific questions or things to verify. Examples:
- "Ask whether anyone has helped them respond to the court papers."
- "Verify the new phone number — old one is bouncing."
- "Confirm the SNAP recertification date the AI extracted from last
  week's intake (the AI flagged uncertainty)."

Hard rules:
1. NEVER invent facts. Only reference activity in the data provided.
2. If the lookback window is empty, say so explicitly. Don't pad.
3. Use the synthetic ref as a name placeholder — the caseworker
   knows who they're meeting; you don't need to repeat the ref.
4. Skip anything the caseworker likely already knows (today's date,
   what coalition the client is in).

Output ONLY plain text — two paragraphs, no headers, no bullet points
in the output. The caseworker reads it fast.`;

export function buildPreMeetingUserPrompt(delta: PersonProfileDelta): string {
  const sinceIso = delta.since.toISOString().slice(0, 10);
  const lines: string[] = [
    `Synthetic person ref: ${delta.syntheticPersonRef}`,
    `Lookback window: since ${sinceIso}`,
    '',
  ];

  if (delta.serviceEvents.length > 0) {
    lines.push('## Service events in window');
    for (const e of delta.serviceEvents) {
      const at = new Date(e.eventAt).toISOString().slice(0, 10);
      const noteFrag = e.notes ? ` — ${e.notes}` : '';
      lines.push(`- ${at} · ${e.partnerOrgName} · ${e.eventType}${noteFrag}`);
    }
    lines.push('');
  } else {
    lines.push('## Service events in window');
    lines.push('(none recorded)');
    lines.push('');
  }

  if (delta.newConsentGrants.length > 0 || delta.newConsentRevocations.length > 0) {
    lines.push('## Consent changes in window');
    for (const c of delta.newConsentGrants) {
      lines.push(`- granted to ${c.partnerOrgName}`);
    }
    for (const c of delta.newConsentRevocations) {
      lines.push(`- revoked from ${c.partnerOrgName}`);
    }
    lines.push('');
  }

  if (delta.newIntakes.length > 0) {
    lines.push('## New intakes in window');
    for (const i of delta.newIntakes) {
      const at = new Date(i.createdAt).toISOString().slice(0, 10);
      const profile = i.extractedProfile as Record<string, unknown> | null;
      const presenting =
        profile && typeof profile.presenting_issue === 'string' ? profile.presenting_issue : null;
      const urgency = profile && typeof profile.urgency === 'string' ? profile.urgency : null;
      lines.push(
        `- ${at} · "${i.label}"${presenting ? ` · ${presenting}` : ''}${urgency ? ` · urgency=${urgency}` : ''}`,
      );
    }
    lines.push('');
  }

  if (delta.newDocuments.length > 0) {
    lines.push('## New documents in window');
    for (const d of delta.newDocuments) {
      const at = new Date(d.createdAt).toISOString().slice(0, 10);
      lines.push(`- ${at} · ${d.kind} · "${d.label}" · status=${d.status}`);
    }
    lines.push('');
  }

  lines.push('Write the briefing.');
  return lines.join('\n');
}
