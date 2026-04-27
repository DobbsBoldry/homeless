import Anthropic from '@anthropic-ai/sdk';
import {
  buildCaseNoteUserPrompt,
  CASE_NOTE_PROMPT_VERSION,
  CASE_NOTE_SYSTEM_PROMPT,
  type CaseNoteInputs,
} from '@/ai/prompts/case-note-generator';

let _client: Anthropic | null = null;
function client(): Anthropic {
  if (!_client) _client = new Anthropic();
  return _client;
}

const MODEL_ID = 'claude-sonnet-4-6';
const MAX_OUTPUT_TOKENS = 800;

export type CaseNoteResult = {
  bodyMd: string;
  modelId: string;
  promptVersion: string;
};

export async function generateCaseNoteDraft(inputs: CaseNoteInputs): Promise<CaseNoteResult> {
  const response = await client().messages.create({
    model: MODEL_ID,
    max_tokens: MAX_OUTPUT_TOKENS,
    system: [
      {
        type: 'text',
        text: CASE_NOTE_SYSTEM_PROMPT,
        cache_control: { type: 'ephemeral' },
      },
    ],
    messages: [{ role: 'user', content: buildCaseNoteUserPrompt(inputs) }],
  });

  const bodyMd = response.content
    .flatMap((c) => (c.type === 'text' ? [c.text] : []))
    .join('\n')
    .trim();
  if (!bodyMd) {
    throw new Error(`[case-note-generator] empty response; stop_reason=${response.stop_reason}`);
  }
  return { bodyMd, modelId: MODEL_ID, promptVersion: CASE_NOTE_PROMPT_VERSION };
}
