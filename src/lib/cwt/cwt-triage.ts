import Anthropic from '@anthropic-ai/sdk';
import { zodOutputFormat } from '@anthropic-ai/sdk/helpers/zod';
import {
  buildCwtTriageUserPrompt,
  CWT_TRIAGE_PROMPT_VERSION,
  CWT_TRIAGE_SYSTEM_PROMPT,
  type CwtTriageOutput,
  CwtTriageOutputSchema,
} from '@/ai/prompts/cwt-triage';
import type { CwtTriageCandidate } from '@/db/queries/cwt-triage';

let _client: Anthropic | null = null;
function client(): Anthropic {
  if (!_client) _client = new Anthropic();
  return _client;
}

const MODEL_ID = 'claude-sonnet-4-6';

export type CwtTriageResult = {
  output: CwtTriageOutput;
  modelId: string;
  promptVersion: string;
  candidateCount: number;
};

export async function generateCwtTriage(
  candidates: CwtTriageCandidate[],
): Promise<CwtTriageResult> {
  if (candidates.length === 0) {
    return {
      output: { picks: [], overall_note: null },
      modelId: MODEL_ID,
      promptVersion: CWT_TRIAGE_PROMPT_VERSION,
      candidateCount: 0,
    };
  }

  const response = await client().messages.parse({
    model: MODEL_ID,
    max_tokens: 1500,
    system: [
      {
        type: 'text',
        text: CWT_TRIAGE_SYSTEM_PROMPT,
        cache_control: { type: 'ephemeral' },
      },
    ],
    messages: [{ role: 'user', content: buildCwtTriageUserPrompt(candidates) }],
    output_config: { format: zodOutputFormat(CwtTriageOutputSchema) },
  });

  if (!response.parsed_output) {
    throw new Error(`[cwt-triage] parse failed; stop_reason=${response.stop_reason}`);
  }

  const validIds = new Set(candidates.map((c) => c.candidateId));
  const cleaned: CwtTriageOutput = {
    picks: response.parsed_output.picks.filter((p) => validIds.has(p.candidate_id)),
    overall_note: response.parsed_output.overall_note,
  };

  return {
    output: cleaned,
    modelId: MODEL_ID,
    promptVersion: CWT_TRIAGE_PROMPT_VERSION,
    candidateCount: candidates.length,
  };
}
