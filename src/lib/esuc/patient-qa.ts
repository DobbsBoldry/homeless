import Anthropic from '@anthropic-ai/sdk';
import {
  buildPatientFactsBlock,
  PATIENT_QA_PROMPT_VERSION,
  PATIENT_QA_SYSTEM_PROMPT,
} from '@/ai/prompts/patient-qa';
import type { EdEncounter } from '@/db/schema/ed-encounters';
import type { EsucCarePlan } from '@/db/schema/esuc-care-plans';

let _client: Anthropic | null = null;
function client(): Anthropic {
  if (!_client) _client = new Anthropic();
  return _client;
}

const MODEL_ID = 'claude-sonnet-4-6';
const MAX_OUTPUT_TOKENS = 700;

export type PatientQATurn = {
  role: 'user' | 'assistant';
  content: string;
};

export type PatientQAResult = {
  answer: string;
  modelId: string;
  promptVersion: string;
};

const HISTORY_HARD_CAP = 30;

export async function answerPatientQuestion(
  facts: { patientId: string; encounters: EdEncounter[]; plan: EsucCarePlan | null },
  history: PatientQATurn[],
): Promise<PatientQAResult> {
  if (history.length === 0) {
    throw new Error('[patient-qa] history must contain at least the user question');
  }
  if (history[history.length - 1].role !== 'user') {
    throw new Error('[patient-qa] last history turn must be the user question');
  }
  const trimmed = history.slice(-HISTORY_HARD_CAP);
  const factsBlock = buildPatientFactsBlock(facts);

  const response = await client().messages.create({
    model: MODEL_ID,
    max_tokens: MAX_OUTPUT_TOKENS,
    system: [
      {
        type: 'text',
        text: PATIENT_QA_SYSTEM_PROMPT,
        cache_control: { type: 'ephemeral' },
      },
      {
        type: 'text',
        text: factsBlock,
        cache_control: { type: 'ephemeral' },
      },
    ],
    messages: trimmed.map((t) => ({ role: t.role, content: t.content })),
  });

  const answer = response.content
    .flatMap((c) => (c.type === 'text' ? [c.text] : []))
    .join('\n')
    .trim();
  if (!answer) {
    throw new Error(`[patient-qa] empty response; stop_reason=${response.stop_reason}`);
  }
  return { answer, modelId: MODEL_ID, promptVersion: PATIENT_QA_PROMPT_VERSION };
}
