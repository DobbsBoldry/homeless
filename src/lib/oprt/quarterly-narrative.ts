import Anthropic from '@anthropic-ai/sdk';
import {
  buildQuarterlyNarrativeUserPrompt,
  QUARTERLY_NARRATIVE_PROMPT_VERSION,
  QUARTERLY_NARRATIVE_SYSTEM_PROMPT,
} from '@/ai/prompts/quarterly-narrative';
import type {
  CoalitionAggregate,
  GovernanceCountsForQuarter,
  Quarter,
  QuarterlyEvictionAggregate,
} from '@/db/queries/public-outcomes';

let _client: Anthropic | null = null;
function client(): Anthropic {
  if (!_client) _client = new Anthropic();
  return _client;
}

const MODEL_ID = 'claude-sonnet-4-6';
const MAX_OUTPUT_TOKENS = 700;

export type QuarterlyNarrativeResult = {
  text: string;
  modelId: string;
  promptVersion: string;
};

export async function generateQuarterlyNarrative(input: {
  quarter: Quarter;
  evictionForQuarter: QuarterlyEvictionAggregate;
  coalitionSnapshot: CoalitionAggregate;
  governanceForQuarter: GovernanceCountsForQuarter;
}): Promise<QuarterlyNarrativeResult> {
  const response = await client().messages.create({
    model: MODEL_ID,
    max_tokens: MAX_OUTPUT_TOKENS,
    system: [
      {
        type: 'text',
        text: QUARTERLY_NARRATIVE_SYSTEM_PROMPT,
        cache_control: { type: 'ephemeral' },
      },
    ],
    messages: [{ role: 'user', content: buildQuarterlyNarrativeUserPrompt(input) }],
  });

  const text = response.content
    .flatMap((c) => (c.type === 'text' ? [c.text] : []))
    .join('\n')
    .trim();
  if (!text) {
    throw new Error(`[quarterly-narrative] empty response; stop_reason=${response.stop_reason}`);
  }
  return { text, modelId: MODEL_ID, promptVersion: QUARTERLY_NARRATIVE_PROMPT_VERSION };
}
