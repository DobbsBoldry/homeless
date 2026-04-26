import { z } from 'zod';

/**
 * Single source of truth for the eviction-filing risk-scoring prompt.
 * Lives in src/ai/prompts/ per CLAUDE.md.
 *
 * Risk score = "how likely is this household to lose housing without
 * legal-aid intervention." Higher score = higher risk = should be
 * prioritized for KLA outreach (see EVDT-015 ranked queue).
 *
 * Inputs are already-public court-record facts only — defendant names
 * and addresses are SCRUBBED before the prompt is rendered. The model
 * never sees them.
 */

export const EVICTION_RISK_SCORE_SYSTEM_PROMPT = `You score Kentucky district-court eviction filings for likelihood that
the defendant household will lose housing without legal intervention.
Higher score = higher risk = should be prioritized for legal-aid outreach.

The output is consumed by attorneys at Kentucky Legal Aid (KLA) to triage
their daily docket. They have ~10-30 minutes per morning to decide who
to call. Your score helps them prioritize, NOT replace their judgment.

Risk factors that PUSH SCORE UP (more risk):
- Status: judgment > served > filed (closer to eviction = higher risk)
- Cause: non_payment > lease_violation > holdover > other
  (non_payment is most common and most defensible)
- Higher amount claimed (more behind = harder to cure)
- Filed close to court date (less time to organize defense)
- Defendant has no attorney representation listed in notes
- Repeat plaintiff filing many cases (institutional landlord, less flexible)

Risk factors that PUSH SCORE DOWN (less risk):
- Status: dismissed (case is over)
- Cause: holdover where lease has clearly ended (less defensible)
- Defendant already represented by counsel
- Sealed status (we don't have the facts to score it; default low + flag)

Output ONLY valid JSON:
{
  "score": <integer 0-100>,
  "rationale": "<1-2 sentence explanation grounded in the facts above>"
}

Be calibrated, not catastrophizing. Most cases are mid-range (40-70).
Reserve 80+ for the genuinely highest-priority cases (judgment status,
high amount, no representation). Reserve <30 for clearly-low-risk
(dismissed, represented, low amount).`;

export const buildRiskUserPrompt = (filing: {
  case_number: string;
  status: string;
  cause_type: string;
  amount_claimed_cents: number | null;
  filed_at: string;
  court_division: string | null;
  plaintiff: string;
  notes: string | null;
  attorney_represented: boolean | null;
}) =>
  `Score this filing.

Case ${filing.case_number}
Status: ${filing.status}
Cause: ${filing.cause_type}
Amount claimed: ${filing.amount_claimed_cents != null ? `$${(filing.amount_claimed_cents / 100).toFixed(2)}` : 'unspecified'}
Filed: ${filing.filed_at}
Court: ${filing.court_division ?? 'unspecified'}
Plaintiff: ${filing.plaintiff}
Defendant attorney: ${
    filing.attorney_represented == null
      ? 'unknown'
      : filing.attorney_represented
        ? 'represented'
        : 'no counsel listed'
  }
Notes: ${filing.notes ?? '(none)'}

Output the JSON object now.`;

export const RiskScoreSchema = z.object({
  score: z.number().int().min(0).max(100),
  rationale: z.string().min(1).max(500),
});

export type ScoredFiling = z.infer<typeof RiskScoreSchema>;

/** Bumped any time the prompt or schema changes. Used as the cache key. */
export const RISK_SCORE_MODEL_VERSION = 'risk-v1@2026-04-26';
