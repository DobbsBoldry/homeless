import Anthropic from '@anthropic-ai/sdk';
import {
  buildPreMeetingUserPrompt,
  PRE_MEETING_SUMMARY_MODEL_VERSION,
  PRE_MEETING_SUMMARY_SYSTEM_PROMPT,
} from '@/ai/prompts/pre-meeting-summary';
import type { PersonProfileDelta } from '@/db/queries/person-profile';

let _client: Anthropic | null = null;
function client(): Anthropic {
  if (!_client) _client = new Anthropic();
  return _client;
}

const MODEL_ID = 'claude-sonnet-4-6';
const MAX_OUTPUT_TOKENS = 400;

export type PreMeetingSummaryResult = {
  text: string;
  modelId: string;
};

/**
 * Generate the 30-second briefing for a pre-meeting view. Returns a
 * plain-text body the UI renders verbatim.
 */
export async function generatePreMeetingSummary(
  delta: PersonProfileDelta,
): Promise<PreMeetingSummaryResult> {
  const response = await client().messages.create({
    model: MODEL_ID,
    max_tokens: MAX_OUTPUT_TOKENS,
    system: [
      {
        type: 'text',
        text: PRE_MEETING_SUMMARY_SYSTEM_PROMPT,
        cache_control: { type: 'ephemeral' },
      },
    ],
    messages: [{ role: 'user', content: buildPreMeetingUserPrompt(delta) }],
  });

  const text = response.content
    .flatMap((c) => (c.type === 'text' ? [c.text] : []))
    .join('\n')
    .trim();
  if (!text) {
    throw new Error(`[pre-meeting-summary] empty response; stop_reason=${response.stop_reason}`);
  }
  return { text, modelId: PRE_MEETING_SUMMARY_MODEL_VERSION };
}
