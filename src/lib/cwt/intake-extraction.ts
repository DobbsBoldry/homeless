import Anthropic from '@anthropic-ai/sdk';
import { zodOutputFormat } from '@anthropic-ai/sdk/helpers/zod';
import {
  buildIntakeUserPrompt,
  INTAKE_EXTRACTION_MODEL_VERSION,
  INTAKE_EXTRACTION_SYSTEM_PROMPT,
  type IntakeProfile,
  IntakeProfileSchema,
} from '@/ai/prompts/intake-extraction';

let _client: Anthropic | null = null;
function client(): Anthropic {
  if (!_client) _client = new Anthropic();
  return _client;
}

const MODEL_ID = 'claude-sonnet-4-6';

export type IntakeExtractionResult = {
  profile: IntakeProfile;
  modelId: string;
};

/**
 * Run Claude over an intake transcript and return the structured
 * profile. Throws on parse failure — caller flips status to 'failed'
 * and shows a retry button.
 */
export async function extractIntake(transcript: string): Promise<IntakeExtractionResult> {
  const response = await client().messages.parse({
    model: MODEL_ID,
    max_tokens: 1500,
    system: [
      {
        type: 'text',
        text: INTAKE_EXTRACTION_SYSTEM_PROMPT,
        cache_control: { type: 'ephemeral' },
      },
    ],
    messages: [{ role: 'user', content: buildIntakeUserPrompt(transcript) }],
    output_config: { format: zodOutputFormat(IntakeProfileSchema) },
  });

  if (!response.parsed_output) {
    throw new Error(
      `[intake-extraction] structured output parse failed; stop_reason=${response.stop_reason}`,
    );
  }
  return { profile: response.parsed_output, modelId: INTAKE_EXTRACTION_MODEL_VERSION };
}
