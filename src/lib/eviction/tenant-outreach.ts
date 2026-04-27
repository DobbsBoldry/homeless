import Anthropic from '@anthropic-ai/sdk';
import {
  buildTenantOutreachUserPrompt,
  TENANT_OUTREACH_PROMPT_VERSION,
  TENANT_OUTREACH_SYSTEM_PROMPT,
} from '@/ai/prompts/eviction-tenant-outreach';
import type { EvictionFiling } from '@/db/schema/eviction-filings';

let _client: Anthropic | null = null;
function client(): Anthropic {
  if (!_client) _client = new Anthropic();
  return _client;
}

const MODEL_ID = 'claude-sonnet-4-6';
const MAX_OUTPUT_TOKENS = 800;

export type OutreachLetterResult = {
  text: string;
  modelId: string;
  promptVersion: string;
};

function scrubForPrompt(filing: EvictionFiling) {
  return {
    case_number: filing.caseNumber,
    defendant_first_name: filing.defendantFirstName,
    cause_type: filing.causeType,
    amount_claimed_cents: filing.amountClaimedCents,
    filed_at: filing.filedAt.toISOString(),
    court_division: filing.courtDivision,
  };
}

/**
 * Generate a tenant outreach letter for a filing. Plain text out;
 * the attorney edits in a textarea before sending. Not persisted —
 * this is an invitation letter, not a court filing, and re-running
 * is cheap.
 */
export async function generateOutreachLetter(
  filing: EvictionFiling,
): Promise<OutreachLetterResult> {
  const inputs = scrubForPrompt(filing);
  const response = await client().messages.create({
    model: MODEL_ID,
    max_tokens: MAX_OUTPUT_TOKENS,
    system: [
      {
        type: 'text',
        text: TENANT_OUTREACH_SYSTEM_PROMPT,
        cache_control: { type: 'ephemeral' },
      },
    ],
    messages: [{ role: 'user', content: buildTenantOutreachUserPrompt(inputs) }],
  });

  const text = response.content
    .flatMap((c) => (c.type === 'text' ? [c.text] : []))
    .join('\n')
    .trim();
  if (!text) {
    throw new Error(`[tenant-outreach] empty response; stop_reason=${response.stop_reason}`);
  }
  return { text, modelId: MODEL_ID, promptVersion: TENANT_OUTREACH_PROMPT_VERSION };
}
