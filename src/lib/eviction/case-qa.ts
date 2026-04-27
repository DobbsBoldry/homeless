import Anthropic from '@anthropic-ai/sdk';
import {
  buildCaseFactsBlock,
  CASE_QA_PROMPT_VERSION,
  CASE_QA_SYSTEM_PROMPT,
  type CaseFacts,
} from '@/ai/prompts/case-qa';

let _client: Anthropic | null = null;
function client(): Anthropic {
  if (!_client) _client = new Anthropic();
  return _client;
}

const MODEL_ID = 'claude-sonnet-4-6';
const MAX_OUTPUT_TOKENS = 700;

/** Single conversation turn. The history we send to Claude is a
 * sequence of these, in chronological order, ending with the user's
 * latest question.
 */
export type CaseQATurn = {
  role: 'user' | 'assistant';
  content: string;
};

export type CaseQAResult = {
  answer: string;
  modelId: string;
  promptVersion: string;
};

/**
 * Send the conversation history (with the new user question at the
 * end) to Claude along with the case facts and return the next
 * assistant turn. Caller is responsible for capping/cleaning the
 * history before invoking — we only enforce a hard ceiling here.
 */
const HISTORY_HARD_CAP = 30;

export async function answerCaseQuestion(
  facts: CaseFacts,
  history: CaseQATurn[],
): Promise<CaseQAResult> {
  if (history.length === 0) {
    throw new Error('[case-qa] history must contain at least the user question');
  }
  if (history[history.length - 1].role !== 'user') {
    throw new Error('[case-qa] last history turn must be the user question');
  }
  const trimmed = history.slice(-HISTORY_HARD_CAP);

  const factsBlock = buildCaseFactsBlock(facts);

  const response = await client().messages.create({
    model: MODEL_ID,
    max_tokens: MAX_OUTPUT_TOKENS,
    system: [
      {
        type: 'text',
        text: CASE_QA_SYSTEM_PROMPT,
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
    throw new Error(`[case-qa] empty response; stop_reason=${response.stop_reason}`);
  }
  return { answer, modelId: MODEL_ID, promptVersion: CASE_QA_PROMPT_VERSION };
}
