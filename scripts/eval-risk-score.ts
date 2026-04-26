#!/usr/bin/env tsx
/**
 * Eval harness for the EVDT-009 risk-scoring service.
 *
 * Reads fixtures/risk-score-eval.json — 20 hand-labelled filings with
 * `expected_band: low | med | high`. Calls Claude on each. Reports
 * % within expected band + score distribution + per-row outliers.
 *
 * Bands:
 *   low  = 0..39
 *   med  = 40..69
 *   high = 70..100
 *
 * Run: pnpm tsx scripts/eval-risk-score.ts
 */
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import Anthropic from '@anthropic-ai/sdk';
import { zodOutputFormat } from '@anthropic-ai/sdk/helpers/zod';
import { config } from 'dotenv';
import {
  buildRiskUserPrompt,
  EVICTION_RISK_SCORE_SYSTEM_PROMPT,
  RISK_SCORE_MODEL_VERSION,
  RiskScoreSchema,
} from '@/ai/prompts/eviction-risk-score';

config({ path: ['.env.local', '.env'], override: true });

if (!process.env.ANTHROPIC_API_KEY) {
  console.error('ANTHROPIC_API_KEY is not set (check .env.local)');
  process.exit(1);
}

type Band = 'low' | 'med' | 'high';
type EvalRow = Parameters<typeof buildRiskUserPrompt>[0] & { expected_band: Band };

function bandOf(score: number): Band {
  if (score < 40) return 'low';
  if (score < 70) return 'med';
  return 'high';
}

async function main() {
  const evalPath = resolve(process.cwd(), 'fixtures/risk-score-eval.json');
  const data = JSON.parse(readFileSync(evalPath, 'utf8')) as { filings: EvalRow[] };
  const client = new Anthropic();

  console.log(`[eval] running ${data.filings.length} filings against ${RISK_SCORE_MODEL_VERSION}`);
  const results: Array<{ row: EvalRow; score: number; band: Band; rationale: string }> = [];

  for (const row of data.filings) {
    const r = await client.messages.parse({
      model: 'claude-opus-4-7',
      max_tokens: 1024,
      system: [
        {
          type: 'text',
          text: EVICTION_RISK_SCORE_SYSTEM_PROMPT,
          cache_control: { type: 'ephemeral' },
        },
      ],
      messages: [{ role: 'user', content: buildRiskUserPrompt(row) }],
      output_config: { format: zodOutputFormat(RiskScoreSchema) },
    });
    if (!r.parsed_output) {
      console.error(`[eval] ${row.case_number}: no parsed output`);
      continue;
    }
    const band = bandOf(r.parsed_output.score);
    results.push({ row, score: r.parsed_output.score, band, rationale: r.parsed_output.rationale });
    const ok = band === row.expected_band ? '✓' : '✗';
    console.log(
      `[eval] ${ok} ${row.case_number}: scored ${r.parsed_output.score} (${band}), expected ${row.expected_band}`,
    );
  }

  const correct = results.filter((r) => r.band === r.row.expected_band).length;
  const pct = (correct / results.length) * 100;
  console.log(`\n[eval] correct band: ${correct}/${results.length} (${pct.toFixed(1)}%)`);

  // Per-band recall
  const groups: Record<Band, { total: number; hit: number }> = {
    low: { total: 0, hit: 0 },
    med: { total: 0, hit: 0 },
    high: { total: 0, hit: 0 },
  };
  for (const r of results) {
    groups[r.row.expected_band].total++;
    if (r.band === r.row.expected_band) groups[r.row.expected_band].hit++;
  }
  for (const b of ['low', 'med', 'high'] as const) {
    const g = groups[b];
    if (g.total > 0) {
      console.log(`[eval]   ${b}: ${g.hit}/${g.total} (${((g.hit / g.total) * 100).toFixed(0)}%)`);
    }
  }

  // Outliers worth a human look
  console.log('\n[eval] outliers (predicted band ≠ expected):');
  for (const r of results.filter((x) => x.band !== x.row.expected_band)) {
    console.log(
      `  ${r.row.case_number}: ${r.score} (${r.band}) vs expected ${r.row.expected_band}`,
    );
    console.log(`    "${r.rationale}"`);
  }
  process.exit(0);
}

main().catch((err) => {
  console.error('[eval] failed', err);
  process.exit(1);
});
