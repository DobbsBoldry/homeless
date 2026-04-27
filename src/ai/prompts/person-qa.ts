/**
 * Person-view Q&A prompt.
 *
 * Caseworker is on the unified person view — they can see the
 * pre-meeting briefing, recent service events, consents, intakes,
 * documents — and asks Claude follow-up questions: "what's the
 * pattern with St. Benedict's?", "is this person engaged with
 * mental health care?", "should I be worried about anything?".
 * Claude answers from the structured profile only and is upfront
 * when the answer isn't in the data.
 */

import type { PersonProfile } from '@/db/queries/person-profile';

export const PERSON_QA_PROMPT_VERSION = 'person-qa-v1@2026-04-26';

export const PERSON_QA_SYSTEM_PROMPT = `You are a case-coordination assistant for a caseworker working
inside a Daviess County, Kentucky homelessness coalition. The
caseworker is looking at one specific person's unified profile
across coalition partners and asking you questions about it.

Voice and constraints:
- Caseworker-to-caseworker tone. Direct, no filler, no "great
  question". No emoji.
- 1-3 short paragraphs. The caseworker is reading between meetings.
- Be honest about what you don't know. The data here is partial —
  many partners aren't in the data trust yet, and some events
  predate the platform. If the question would need real
  conversation history, eviction data, or ED encounters, say so.
- Never invent facts. If the user asks "have they been to the
  shelter this week?" and the answer isn't in the events, say "I
  don't see a shelter event in the lookback."
- This is NOT clinical advice. If asked things like "do they need
  inpatient psychiatric care", reframe: "Based on what's in the
  record, here's what I'd flag — your judgment on next steps."
- Don't repeat the synthetic_person_ref. The caseworker knows who
  they're asking about.

Scope of what you have access to:
- Cross-partner service events (date, partner, event type, notes)
- Partner consents (granted / revoked, by partner)
- Voice intake history (label, date, presenting issue, urgency,
  flags from extraction, top needs)
- Documents on file (label, kind, status)

You do NOT have access to:
- Eviction filings (different identifier; not joined yet)
- ED encounters or care plans (different identifier)
- The actual content of intake transcripts (only the extracted
  fields above)
- Anything outside the coalition data trust (private partner
  systems, the client's own phone, etc.)

Output: plain text. No markdown headers. Inline lists are fine.`;

export function buildPersonProfileBlock(profile: PersonProfile): string {
  const lines: string[] = [`Synthetic person ref: ${profile.syntheticPersonRef}`, ''];

  if (profile.serviceEvents.length > 0) {
    lines.push(`## Service events (${profile.serviceEvents.length})`);
    for (const e of profile.serviceEvents) {
      const at = new Date(e.eventAt).toISOString().slice(0, 10);
      const noteFrag = e.notes ? ` — ${e.notes}` : '';
      lines.push(`- ${at} · ${e.partnerOrgName} · ${e.eventType}${noteFrag}`);
    }
    lines.push('');
  } else {
    lines.push('## Service events: (none recorded)');
    lines.push('');
  }

  if (profile.consents.length > 0) {
    lines.push(`## Consents (${profile.consents.length})`);
    for (const c of profile.consents) {
      const granted = new Date(c.grantedAt).toISOString().slice(0, 10);
      const revoked = c.revokedAt ? new Date(c.revokedAt).toISOString().slice(0, 10) : null;
      lines.push(
        `- ${c.partnerOrgName} · granted ${granted}${revoked ? ` · revoked ${revoked}` : ' · active'}`,
      );
    }
    lines.push('');
  }

  if (profile.intakes.length > 0) {
    lines.push(`## Voice intakes (${profile.intakes.length})`);
    for (const i of profile.intakes) {
      const at = new Date(i.createdAt).toISOString().slice(0, 10);
      const p = i.extractedProfile as Record<string, unknown> | null;
      const presenting = p && typeof p.presenting_issue === 'string' ? p.presenting_issue : null;
      const urgency = p && typeof p.urgency === 'string' ? p.urgency : null;
      const flags =
        p?.flags && typeof p.flags === 'object'
          ? Object.entries(p.flags as Record<string, boolean>)
              .filter(([, v]) => v === true)
              .map(([k]) => k)
              .join(', ')
          : '';
      const topNeeds = p && Array.isArray(p.top_needs) ? (p.top_needs as string[]).join(', ') : '';
      lines.push(
        `- ${at} · "${i.label}" · status=${i.status}` +
          (presenting ? ` · presenting: ${presenting}` : '') +
          (urgency ? ` · urgency=${urgency}` : '') +
          (flags ? ` · flags: ${flags}` : '') +
          (topNeeds ? ` · needs: ${topNeeds}` : ''),
      );
    }
    lines.push('');
  }

  if (profile.documents.length > 0) {
    lines.push(`## Documents (${profile.documents.length})`);
    for (const d of profile.documents) {
      const at = new Date(d.createdAt).toISOString().slice(0, 10);
      lines.push(`- ${at} · ${d.kind} · "${d.label}" · status=${d.status}`);
    }
    lines.push('');
  }

  return lines.join('\n');
}
