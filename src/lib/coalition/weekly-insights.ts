import Anthropic from '@anthropic-ai/sdk';
import {
  buildCoalitionInsightsUserPrompt,
  COALITION_INSIGHTS_PROMPT_VERSION,
  COALITION_INSIGHTS_SYSTEM_PROMPT,
} from '@/ai/prompts/coalition-insights';
import type { CoalitionWeeklyDigest } from '@/db/queries/coalition-weekly-digest';

let _client: Anthropic | null = null;
function client(): Anthropic {
  if (!_client) _client = new Anthropic();
  return _client;
}

const MODEL_ID = 'claude-sonnet-4-6';
const MAX_OUTPUT_TOKENS = 500;

export type CoalitionInsightsResult = {
  text: string;
  modelId: string;
  promptVersion: string;
};

export async function generateCoalitionInsights(
  digest: CoalitionWeeklyDigest,
): Promise<CoalitionInsightsResult> {
  const response = await client().messages.create({
    model: MODEL_ID,
    max_tokens: MAX_OUTPUT_TOKENS,
    system: [
      {
        type: 'text',
        text: COALITION_INSIGHTS_SYSTEM_PROMPT,
        cache_control: { type: 'ephemeral' },
      },
    ],
    messages: [{ role: 'user', content: buildCoalitionInsightsUserPrompt(digest) }],
  });

  const text = response.content
    .flatMap((c) => (c.type === 'text' ? [c.text] : []))
    .join('\n')
    .trim();
  if (!text) {
    throw new Error(`[coalition-insights] empty response; stop_reason=${response.stop_reason}`);
  }
  return { text, modelId: MODEL_ID, promptVersion: COALITION_INSIGHTS_PROMPT_VERSION };
}
