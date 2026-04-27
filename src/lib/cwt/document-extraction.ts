import Anthropic from '@anthropic-ai/sdk';
import { zodOutputFormat } from '@anthropic-ai/sdk/helpers/zod';
import {
  buildExtractionUserPrompt,
  DOCUMENT_EXTRACTION_MODEL_VERSION,
  DOCUMENT_EXTRACTION_SYSTEM_PROMPT,
  ExtractionSchemaByKind,
} from '@/ai/prompts/document-extraction';
import type { ClientDocumentKind } from '@/db/schema/enums';

let _client: Anthropic | null = null;
function client(): Anthropic {
  if (!_client) _client = new Anthropic();
  return _client;
}

export type ExtractionResult = {
  fields: Record<string, unknown>;
  notes: string | null;
  modelId: string;
};

const MODEL_ID = 'claude-sonnet-4-6';

/**
 * Run Claude extraction over a document body. Returns the structured
 * fields keyed per the per-kind schema, plus the AI-supplied notes
 * string. Throws on parse failure — caller should mark the document
 * as `failed` and surface the error.
 */
export async function extractDocument(
  kind: ClientDocumentKind,
  contentMd: string,
): Promise<ExtractionResult> {
  const schema = ExtractionSchemaByKind[kind];
  const response = await client().messages.parse({
    model: MODEL_ID,
    max_tokens: 1024,
    system: [
      {
        type: 'text',
        text: DOCUMENT_EXTRACTION_SYSTEM_PROMPT,
        cache_control: { type: 'ephemeral' },
      },
    ],
    messages: [{ role: 'user', content: buildExtractionUserPrompt(kind, contentMd) }],
    output_config: { format: zodOutputFormat(schema) },
  });

  if (!response.parsed_output) {
    throw new Error(
      `[document-extraction] structured output parse failed for kind=${kind}; stop_reason=${response.stop_reason}`,
    );
  }
  const fields = response.parsed_output as Record<string, unknown>;
  const notes = typeof fields.notes === 'string' ? fields.notes : null;
  // Use the prompt-level version stamp as the audit-trail "model" id —
  // it includes both the model name and the prompt revision so a
  // future audit can tell which version produced which row.
  return { fields, notes, modelId: DOCUMENT_EXTRACTION_MODEL_VERSION };
}
