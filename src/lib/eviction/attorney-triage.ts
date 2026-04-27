import Anthropic from '@anthropic-ai/sdk';
import { zodOutputFormat } from '@anthropic-ai/sdk/helpers/zod';
import {
  ATTORNEY_TRIAGE_PROMPT_VERSION,
  ATTORNEY_TRIAGE_SYSTEM_PROMPT,
  type AttorneyTriageOutput,
  AttorneyTriageOutputSchema,
  buildAttorneyTriageUserPrompt,
} from '@/ai/prompts/attorney-triage';
import type { TriageCandidate } from '@/db/queries/attorney-triage';

let _client: Anthropic | null = null;
function client(): Anthropic {
  if (!_client) _client = new Anthropic();
  return _client;
}

const MODEL_ID = 'claude-sonnet-4-6';

export type AttorneyTriageResult = {
  output: AttorneyTriageOutput;
  modelId: string;
  promptVersion: string;
  candidateCount: number;
};

export async function generateAttorneyTriage(
  candidates: TriageCandidate[],
): Promise<AttorneyTriageResult> {
  if (candidates.length === 0) {
    return {
      output: { picks: [], overall_note: null },
      modelId: MODEL_ID,
      promptVersion: ATTORNEY_TRIAGE_PROMPT_VERSION,
      candidateCount: 0,
    };
  }

  const response = await client().messages.parse({
    model: MODEL_ID,
    max_tokens: 1500,
    system: [
      {
        type: 'text',
        text: ATTORNEY_TRIAGE_SYSTEM_PROMPT,
        cache_control: { type: 'ephemeral' },
      },
    ],
    messages: [{ role: 'user', content: buildAttorneyTriageUserPrompt(candidates) }],
    output_config: { format: zodOutputFormat(AttorneyTriageOutputSchema) },
  });

  if (!response.parsed_output) {
    throw new Error(`[attorney-triage] parse failed; stop_reason=${response.stop_reason}`);
  }

  // Belt-and-braces: drop any picks the model invented (filing_id not
  // in candidates). Don't trust unconstrained model output to
  // reference real DB rows.
  const validIds = new Set(candidates.map((c) => c.filing.id));
  const cleaned: AttorneyTriageOutput = {
    picks: response.parsed_output.picks.filter((p) => validIds.has(p.filing_id)),
    overall_note: response.parsed_output.overall_note,
  };

  return {
    output: cleaned,
    modelId: MODEL_ID,
    promptVersion: ATTORNEY_TRIAGE_PROMPT_VERSION,
    candidateCount: candidates.length,
  };
}
