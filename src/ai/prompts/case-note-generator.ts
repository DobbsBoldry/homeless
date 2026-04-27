/**
 * CWT-004: case-note draft generator.
 *
 * Caseworker on the person view clicks "Draft case note" and Claude
 * writes a narrative note in the caseworker's voice, drawn from the
 * structured profile (extracted intake fields + recent service
 * events + flags). Output is markdown ready to drop into a
 * case-management record. The caseworker reviews and edits — every
 * edit lands as a new version of the note (CWT-005), so AI vs. human
 * authorship is auditable.
 *
 * Voice constraints: caseworker-to-record, past tense, factual, no
 * judgment language. The note is a narrative summary of a person's
 * situation, not a recommendation.
 */

import type { PersonProfile } from '@/db/queries/person-profile';
import type { IntakeProfile } from './intake-extraction';

export const CASE_NOTE_PROMPT_VERSION = 'case-note-v1@2026-04-27';

export const CASE_NOTE_SYSTEM_PROMPT = `You write a draft case note for a caseworker working in a Daviess
County, Kentucky homelessness coalition. The caseworker reviews
and edits before saving — they are the author of record; you are
just saving them typing.

Voice and constraints:
- Caseworker-to-record. Past tense, third person. Factual. No
  emoji.
- Plain English, no clinical or legal jargon.
- One short paragraph for each substantive topic; ~150-300 words
  total.
- Reference the client by first name when given (the intake
  extraction may carry one); otherwise use neutral phrasing
  ("the client", "they"). NEVER invent a name.
- Surface what the structured data shows AND what's missing — a
  good case note flags gaps as much as facts. Examples: "income
  was not discussed during intake", "documents in hand were not
  recorded".

Structure (no headers, just paragraphs):

1. **Presenting situation** — what brought the client in. One
   sentence pulled from the intake's presenting_issue + urgency.
2. **Household + housing** — composition, current housing status,
   stability signals.
3. **Income + benefits** — what's coming in, what's already
   enrolled, what gaps were flagged.
4. **Cross-coalition activity** — relevant service events at
   partners (last 30 days), if any. If none recorded, say so.
5. **Watch / next** — 1-2 sentences naming what the caseworker
   should watch for or follow up on. Anchored in flags from the
   intake (DV concern, SUD engaged, MH engaged, has-caseworker-
   relationship) or in service-event patterns.

Hard rules:
1. NEVER invent a fact. If a field is null/empty in the input,
   either skip it (preferred for short fields) or say "not
   discussed" / "not recorded".
2. NEVER editorialize beyond the data. Don't say "the client is
   doing well" or "this is concerning" without grounding.
3. NEVER include the synthetic_person_ref in the note body —
   it's a system identifier, not part of a record narrative.
4. Output ONLY the markdown body. No headers like "Case note:".`;

export type CaseNoteInputs = {
  syntheticPersonRef: string;
  profile: PersonProfile;
  intakeProfile: IntakeProfile | null;
};

export function buildCaseNoteUserPrompt(inputs: CaseNoteInputs): string {
  const { profile, intakeProfile } = inputs;
  const lines: string[] = [
    'Draft a case note from the structured data below.',
    '',
    `Today's date: ${new Date().toISOString().slice(0, 10)}`,
    '',
  ];

  if (intakeProfile) {
    lines.push('## Intake extraction');
    lines.push(`- First name: ${intakeProfile.client_first_name ?? '(not given)'}`);
    lines.push(`- Household size: ${intakeProfile.household_size ?? '(not discussed)'}`);
    lines.push(
      `- Children under 18: ${
        intakeProfile.has_children_under_18 == null
          ? '(not discussed)'
          : intakeProfile.has_children_under_18
            ? `yes${intakeProfile.num_children ? ` (${intakeProfile.num_children})` : ''}`
            : 'no'
      }`,
    );
    lines.push(`- Presenting issue: ${intakeProfile.presenting_issue ?? '(not given)'}`);
    lines.push(`- Urgency: ${intakeProfile.urgency ?? '(not classified)'}`);
    lines.push(`- Housing status: ${intakeProfile.housing_status ?? '(not discussed)'}`);
    lines.push(`- Income summary: ${intakeProfile.income_summary ?? '(not discussed)'}`);
    lines.push(
      `- Benefits currently receiving: ${
        intakeProfile.benefits_currently_receiving == null
          ? '(not discussed)'
          : intakeProfile.benefits_currently_receiving.length === 0
            ? 'none'
            : intakeProfile.benefits_currently_receiving.join(', ')
      }`,
    );
    lines.push(
      `- Documents in hand: ${
        intakeProfile.documents_in_hand == null
          ? '(not discussed)'
          : intakeProfile.documents_in_hand.length === 0
            ? 'none'
            : intakeProfile.documents_in_hand.join(', ')
      }`,
    );
    lines.push(
      `- Top needs: ${intakeProfile.top_needs?.length ? intakeProfile.top_needs.join(', ') : '(none recorded)'}`,
    );
    const flags = intakeProfile.flags
      ? Object.entries(intakeProfile.flags)
          .filter(([, v]) => v === true)
          .map(([k]) => k)
      : [];
    lines.push(`- Flags: ${flags.length > 0 ? flags.join(', ') : 'none'}`);
    if (intakeProfile.notes) lines.push(`- Extraction notes: ${intakeProfile.notes}`);
    lines.push('');
  } else {
    lines.push('## Intake extraction: (none on file for this person)');
    lines.push('');
  }

  if (profile.serviceEvents.length > 0) {
    lines.push('## Recent service events (across coalition partners)');
    for (const e of profile.serviceEvents.slice(0, 12)) {
      const at = new Date(e.eventAt).toISOString().slice(0, 10);
      const noteFrag = e.notes ? ` — ${e.notes}` : '';
      lines.push(`- ${at} · ${e.partnerOrgName} · ${e.eventType}${noteFrag}`);
    }
    lines.push('');
  } else {
    lines.push('## Recent service events: (none recorded)');
    lines.push('');
  }

  if (profile.documents.length > 0) {
    lines.push('## Documents on file');
    for (const d of profile.documents.slice(0, 8)) {
      lines.push(`- ${d.kind} · ${d.label} · status=${d.status}`);
    }
    lines.push('');
  }

  lines.push('Draft the case note now.');
  return lines.join('\n');
}
