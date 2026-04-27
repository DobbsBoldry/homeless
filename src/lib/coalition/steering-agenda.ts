import Anthropic from '@anthropic-ai/sdk';
import {
  buildSteeringAgendaUserPrompt,
  STEERING_AGENDA_PROMPT_VERSION,
  STEERING_AGENDA_SYSTEM_PROMPT,
  type SteeringAgendaInputs,
} from '@/ai/prompts/steering-agenda';

let _client: Anthropic | null = null;
function client(): Anthropic {
  if (!_client) _client = new Anthropic();
  return _client;
}

const MODEL_ID = 'claude-sonnet-4-6';
const MAX_OUTPUT_TOKENS = 800;

export type SteeringAgendaResult = {
  agendaMd: string;
  modelId: string;
  promptVersion: string;
};

export async function draftSteeringAgenda(
  inputs: SteeringAgendaInputs,
): Promise<SteeringAgendaResult> {
  const response = await client().messages.create({
    model: MODEL_ID,
    max_tokens: MAX_OUTPUT_TOKENS,
    system: [
      {
        type: 'text',
        text: STEERING_AGENDA_SYSTEM_PROMPT,
        cache_control: { type: 'ephemeral' },
      },
    ],
    messages: [{ role: 'user', content: buildSteeringAgendaUserPrompt(inputs) }],
  });

  const agendaMd = response.content
    .flatMap((c) => (c.type === 'text' ? [c.text] : []))
    .join('\n')
    .trim();
  if (!agendaMd) {
    throw new Error(`[steering-agenda] empty response; stop_reason=${response.stop_reason}`);
  }
  return { agendaMd, modelId: MODEL_ID, promptVersion: STEERING_AGENDA_PROMPT_VERSION };
}
