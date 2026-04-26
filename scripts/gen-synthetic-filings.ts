#!/usr/bin/env tsx
/**
 * Generate synthetic Daviess District Court eviction filings via Claude API.
 *
 * Usage:
 *   pnpm tsx scripts/gen-synthetic-filings.ts --count 50 --out fixtures/eviction-filings.json
 *   pnpm tsx scripts/gen-synthetic-filings.ts --count 10 --seed 42 --out fixtures/sample.json
 *
 * Notes:
 * - Requires ANTHROPIC_API_KEY in env (.env.local works).
 * - The seed flag varies prompt phrasing run-over-run, but Claude is not
 *   strictly deterministic — same seed gives similar (not byte-identical) output.
 * - Output JSON shape: { filings: SyntheticFiling[] } per FilingBatchSchema.
 * - Generated filings are clearly synthetic (case_number prefix SYN-, fake
 *   names + addresses) so they cannot be confused with real public records.
 */
import { mkdir, writeFile } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { parseArgs } from 'node:util';
import Anthropic from '@anthropic-ai/sdk';
import { zodOutputFormat } from '@anthropic-ai/sdk/helpers/zod';
import { config } from 'dotenv';
import {
  buildUserPrompt,
  FilingBatchSchema,
  SYNTHETIC_FILING_SYSTEM_PROMPT,
  type SyntheticFiling,
} from '@/ai/prompts/synthetic-eviction-filings';

// override:true so .env.local wins over shell-preset empty values
// (Claude Code injects an empty ANTHROPIC_API_KEY in some setups).
config({ path: ['.env.local', '.env'], override: true });

const { values } = parseArgs({
  options: {
    count: { type: 'string', default: '20' },
    seed: { type: 'string', default: String(Date.now() % 100_000) },
    out: { type: 'string', default: 'fixtures/eviction-filings.json' },
  },
});

const count = Number(values.count);
const seed = Number(values.seed);
const outPath = resolve(process.cwd(), values.out);

if (!Number.isFinite(count) || count <= 0 || count > 200) {
  console.error('--count must be a positive integer ≤ 200');
  process.exit(1);
}
if (!process.env.ANTHROPIC_API_KEY) {
  console.error('ANTHROPIC_API_KEY is not set (check .env.local)');
  process.exit(1);
}

async function main() {
  const client = new Anthropic();
  console.log(`[gen] requesting ${count} synthetic filings (seed=${seed})…`);

  const response = await client.messages.parse({
    model: 'claude-opus-4-7',
    max_tokens: 16_000,
    system: [
      {
        type: 'text',
        text: SYNTHETIC_FILING_SYSTEM_PROMPT,
        cache_control: { type: 'ephemeral' },
      },
    ],
    messages: [
      {
        role: 'user',
        content: buildUserPrompt(count, seed, new Date().toISOString().slice(0, 10)),
      },
    ],
    output_config: { format: zodOutputFormat(FilingBatchSchema) },
  });

  if (!response.parsed_output) {
    console.error('[gen] structured output parsing failed; stop_reason:', response.stop_reason);
    process.exit(1);
  }

  const filings: SyntheticFiling[] = response.parsed_output.filings;
  console.log(`[gen] received ${filings.length} filings`);
  console.log(
    `[gen] tokens: input=${response.usage.input_tokens}` +
      ` cached_read=${response.usage.cache_read_input_tokens ?? 0}` +
      ` output=${response.usage.output_tokens}`,
  );

  await mkdir(dirname(outPath), { recursive: true });
  await writeFile(
    outPath,
    JSON.stringify(
      { generated_at: new Date().toISOString(), seed, count: filings.length, filings },
      null,
      2,
    ),
  );
  console.log(`[gen] wrote ${outPath}`);
}

main().catch((err) => {
  console.error('[gen] failed', err);
  process.exit(1);
});
