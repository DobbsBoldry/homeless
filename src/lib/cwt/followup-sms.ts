import Anthropic from '@anthropic-ai/sdk';
import {
  buildFollowupSmsUserPrompt,
  FOLLOWUP_SMS_PROMPT_VERSION,
  FOLLOWUP_SMS_SYSTEM_PROMPT,
  type FollowupSmsInputs,
} from '@/ai/prompts/followup-sms';

let _client: Anthropic | null = null;
function client(): Anthropic {
  if (!_client) _client = new Anthropic();
  return _client;
}

const MODEL_ID = 'claude-sonnet-4-6';
const MAX_OUTPUT_TOKENS = 200;

export type FollowupSmsResult = {
  text: string;
  modelId: string;
  promptVersion: string;
};

export async function generateFollowupSms(inputs: FollowupSmsInputs): Promise<FollowupSmsResult> {
  const response = await client().messages.create({
    model: MODEL_ID,
    max_tokens: MAX_OUTPUT_TOKENS,
    system: [
      {
        type: 'text',
        text: FOLLOWUP_SMS_SYSTEM_PROMPT,
        cache_control: { type: 'ephemeral' },
      },
    ],
    messages: [{ role: 'user', content: buildFollowupSmsUserPrompt(inputs) }],
  });

  const text = response.content
    .flatMap((c) => (c.type === 'text' ? [c.text] : []))
    .join('\n')
    .trim();
  if (!text) {
    throw new Error(`[followup-sms] empty response; stop_reason=${response.stop_reason}`);
  }
  return { text, modelId: MODEL_ID, promptVersion: FOLLOWUP_SMS_PROMPT_VERSION };
}
