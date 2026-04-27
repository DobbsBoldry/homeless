import Anthropic from '@anthropic-ai/sdk';
import {
  buildPlaintiffPatternsUserPrompt,
  PLAINTIFF_PATTERNS_PROMPT_VERSION,
  PLAINTIFF_PATTERNS_SYSTEM_PROMPT,
} from '@/ai/prompts/plaintiff-patterns';
import type { TopPlaintiff } from '@/db/queries/eviction-filings';

let _client: Anthropic | null = null;
function client(): Anthropic {
  if (!_client) _client = new Anthropic();
  return _client;
}

const MODEL_ID = 'claude-sonnet-4-6';
const MAX_OUTPUT_TOKENS = 250;

export type PlaintiffPatternsResult = {
  text: string;
  modelId: string;
  promptVersion: string;
};

export async function commentOnPlaintiffPatterns(input: {
  windowDays: number;
  minCount: number;
  plaintiffs: TopPlaintiff[];
}): Promise<PlaintiffPatternsResult> {
  const response = await client().messages.create({
    model: MODEL_ID,
    max_tokens: MAX_OUTPUT_TOKENS,
    system: [
      {
        type: 'text',
        text: PLAINTIFF_PATTERNS_SYSTEM_PROMPT,
        cache_control: { type: 'ephemeral' },
      },
    ],
    messages: [{ role: 'user', content: buildPlaintiffPatternsUserPrompt(input) }],
  });

  const text = response.content
    .flatMap((c) => (c.type === 'text' ? [c.text] : []))
    .join('\n')
    .trim();
  if (!text) {
    throw new Error(`[plaintiff-patterns] empty response; stop_reason=${response.stop_reason}`);
  }
  return { text, modelId: MODEL_ID, promptVersion: PLAINTIFF_PATTERNS_PROMPT_VERSION };
}
