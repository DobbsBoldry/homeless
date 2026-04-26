import Anthropic from '@anthropic-ai/sdk';
import { zodOutputFormat } from '@anthropic-ai/sdk/helpers/zod';
import { and, eq } from 'drizzle-orm';
import {
  buildRiskUserPrompt,
  EVICTION_RISK_SCORE_SYSTEM_PROMPT,
  RISK_SCORE_MODEL_VERSION,
  RiskScoreSchema,
  type ScoredFiling,
} from '@/ai/prompts/eviction-risk-score';
import { db } from '@/db/client';
import {
  type EvictionFilingRiskScore,
  evictionFilingRiskScores,
  type NewEvictionFilingRiskScore,
} from '@/db/schema/eviction-filing-risk-scores';
import { type EvictionFiling, evictionFilings } from '@/db/schema/eviction-filings';

let _client: Anthropic | null = null;
function client(): Anthropic {
  if (!_client) _client = new Anthropic();
  return _client;
}

/**
 * Project the parts of an EvictionFiling that the model is allowed to see.
 * Defendant first/last name + address are NOT included — they're public
 * record but not load-bearing for the score, and keeping them out keeps
 * the prompt PHI-fence-clean by construction (CLAUDE.md).
 */
function scrubForPrompt(filing: EvictionFiling) {
  return {
    case_number: filing.caseNumber,
    status: filing.status,
    cause_type: filing.causeType,
    amount_claimed_cents: filing.amountClaimedCents,
    filed_at: filing.filedAt.toISOString(),
    court_division: filing.courtDivision,
    plaintiff: filing.plaintiff,
    notes:
      ((filing.rawJson as Record<string, unknown> | null)?.notes as string | undefined) ?? null,
    attorney_represented:
      ((filing.rawJson as Record<string, unknown> | null)?.attorney_represented as
        | boolean
        | undefined) ?? null,
  };
}

/**
 * Score one filing. Idempotent: returns the cached score for
 * (filing_id, RISK_SCORE_MODEL_VERSION) if one exists. Otherwise calls
 * Claude, persists, returns the persisted row.
 */
export async function scoreFiling(filing: EvictionFiling): Promise<EvictionFilingRiskScore> {
  const cached = await db
    .select()
    .from(evictionFilingRiskScores)
    .where(
      and(
        eq(evictionFilingRiskScores.filingId, filing.id),
        eq(evictionFilingRiskScores.modelVersion, RISK_SCORE_MODEL_VERSION),
      ),
    )
    .limit(1);
  if (cached.length > 0) return cached[0];

  const inputs = scrubForPrompt(filing);

  const response = await client().messages.parse({
    model: 'claude-opus-4-7',
    max_tokens: 1024,
    system: [
      {
        type: 'text',
        text: EVICTION_RISK_SCORE_SYSTEM_PROMPT,
        cache_control: { type: 'ephemeral' },
      },
    ],
    messages: [{ role: 'user', content: buildRiskUserPrompt(inputs) }],
    output_config: { format: zodOutputFormat(RiskScoreSchema) },
  });

  if (!response.parsed_output) {
    throw new Error(
      `[risk-score] structured output parse failed; stop_reason=${response.stop_reason}`,
    );
  }
  const scored: ScoredFiling = response.parsed_output;

  const newRow: NewEvictionFilingRiskScore = {
    filingId: filing.id,
    score: scored.score,
    rationale: scored.rationale,
    modelVersion: RISK_SCORE_MODEL_VERSION,
  };
  const [persisted] = await db
    .insert(evictionFilingRiskScores)
    .values(newRow)
    .onConflictDoNothing({
      target: [evictionFilingRiskScores.filingId, evictionFilingRiskScores.modelVersion],
    })
    .returning();

  // If a concurrent call beat us, re-select.
  if (persisted) return persisted;
  const [winner] = await db
    .select()
    .from(evictionFilingRiskScores)
    .where(
      and(
        eq(evictionFilingRiskScores.filingId, filing.id),
        eq(evictionFilingRiskScores.modelVersion, RISK_SCORE_MODEL_VERSION),
      ),
    )
    .limit(1);
  return winner;
}

/** Convenience: fetch the latest score row for a filing, or null. */
export async function getLatestScore(filingId: string): Promise<EvictionFilingRiskScore | null> {
  const rows = await db
    .select()
    .from(evictionFilingRiskScores)
    .where(eq(evictionFilingRiskScores.filingId, filingId))
    .limit(1);
  return rows[0] ?? null;
}

/** Re-export so callers don't have to import from two paths. */
export { evictionFilings };
