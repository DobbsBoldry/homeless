import Anthropic from '@anthropic-ai/sdk';
import {
  buildPersonProfileBlock,
  PERSON_QA_PROMPT_VERSION,
  PERSON_QA_SYSTEM_PROMPT,
} from '@/ai/prompts/person-qa';
import type { PersonProfile } from '@/db/queries/person-profile';

let _client: Anthropic | null = null;
function client(): Anthropic {
  if (!_client) _client = new Anthropic();
  return _client;
}

const MODEL_ID = 'claude-sonnet-4-6';
const MAX_OUTPUT_TOKENS = 700;

export type PersonQATurn = {
  role: 'user' | 'assistant';
  content: string;
};

export type PersonQAResult = {
  answer: string;
  modelId: string;
  promptVersion: string;
};

const HISTORY_HARD_CAP = 30;

export async function answerPersonQuestion(
  profile: PersonProfile,
  history: PersonQATurn[],
): Promise<PersonQAResult> {
  if (history.length === 0) {
    throw new Error('[person-qa] history must contain at least the user question');
  }
  if (history[history.length - 1].role !== 'user') {
    throw new Error('[person-qa] last history turn must be the user question');
  }
  const trimmed = history.slice(-HISTORY_HARD_CAP);
  const factsBlock = buildPersonProfileBlock(profile);

  const response = await client().messages.create({
    model: MODEL_ID,
    max_tokens: MAX_OUTPUT_TOKENS,
    system: [
      {
        type: 'text',
        text: PERSON_QA_SYSTEM_PROMPT,
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
    throw new Error(`[person-qa] empty response; stop_reason=${response.stop_reason}`);
  }
  return { answer, modelId: MODEL_ID, promptVersion: PERSON_QA_PROMPT_VERSION };
}
