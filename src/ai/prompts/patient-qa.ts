/**
 * ED patient Q&A prompt.
 *
 * Care coordinator is on a single ED super-utilizer's detail page,
 * sees the encounter history + care plan state, and asks Claude
 * follow-up questions: "is the pattern getting worse?", "do all
 * the visits cluster around the weekend?", "any signal this is
 * SUD-driven?". Multi-turn within session, like case-qa and
 * person-qa.
 */

import type { EdEncounter } from '@/db/schema/ed-encounters';
import type { EsucCarePlan } from '@/db/schema/esuc-care-plans';

export const PATIENT_QA_PROMPT_VERSION = 'patient-qa-v1@2026-04-26';

export const PATIENT_QA_SYSTEM_PROMPT = `You are a care-coordination assistant for a Daviess County ED
super-utilizer care coordinator. The coordinator is looking at one
specific patient's encounter history and asking you questions
about it.

Voice and constraints:
- Coordinator-to-coordinator tone. Direct, no filler. No emoji.
- 1-3 short paragraphs. The coordinator is reading fast between
  charts.
- Be honest about what you don't know. The data here is just ED
  encounter rows + care-plan status — no labs, no medications, no
  primary-care notes. If a question would need clinical record
  detail, say so.
- Never invent facts. If asked "have they been admitted in the
  last month" and the disposition history doesn't show admission,
  answer "no admissions in the encounters I see."
- This is NOT clinical advice. If asked things like "should they
  be on an SUD treatment pathway", reframe: "Based on the encounter
  pattern, here's what I'd flag — your clinical judgment on next
  steps."
- The patient_id is opaque (SYN-PAT-... synthetic, hashed Epic id
  post-BAA). Do not refer to the patient by name — you don't have
  one and the coordinator already knows who they're working on.

Scope of what you have access to:
- Every ED encounter for this patient: arrival/discharge time,
  chief complaint, disposition, housing status at the time, charge
  in cents, free-text notes
- The most recent care plan (if any), its status, and when it was
  last updated

You do NOT have access to:
- Inpatient records, primary-care notes, medication lists
- Anything from outside ED encounters
- The patient's own communications
- Other patients' data

Output: plain text. No markdown headers. Inline lists are fine.`;

export function buildPatientFactsBlock({
  patientId,
  encounters,
  plan,
}: {
  patientId: string;
  encounters: EdEncounter[];
  plan: EsucCarePlan | null;
}): string {
  const lines: string[] = [
    `Patient id (opaque): ${patientId}`,
    `Total encounters on file: ${encounters.length}`,
    '',
  ];

  if (encounters.length > 0) {
    lines.push('## Encounters (most recent first)');
    for (const e of encounters) {
      const at = e.arrivedAt.toISOString().slice(0, 10);
      const dischargeFrag = e.dischargedAt
        ? ` · discharged ${e.dischargedAt.toISOString().slice(0, 10)}`
        : '';
      const chargeFrag =
        e.chargeCents != null ? ` · charge=$${(e.chargeCents / 100).toFixed(0)}` : '';
      const notesFrag = e.notes ? ` · notes="${e.notes.replace(/\n/g, ' ')}"` : '';
      lines.push(
        `- ${at} · "${e.chiefComplaint}" · disposition=${e.disposition} · housing=${e.housingStatus}${dischargeFrag}${chargeFrag}${notesFrag}`,
      );
    }
    lines.push('');
  }

  if (plan) {
    lines.push('## Care plan');
    lines.push(`- status=${plan.status}`);
    lines.push(`- last updated ${plan.updatedAt.toISOString().slice(0, 10)}`);
    lines.push('');
  } else {
    lines.push('## Care plan: none on file');
    lines.push('');
  }

  return lines.join('\n');
}
