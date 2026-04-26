#!/usr/bin/env tsx
/**
 * Generate synthetic ED encounters via Claude API. Mirror of
 * gen-synthetic-filings.ts.
 *
 * Usage:
 *   pnpm tsx scripts/gen-synthetic-ed-encounters.ts --count 100 --out fixtures/ed-encounters.json
 *   pnpm tsx scripts/gen-synthetic-ed-encounters.ts --count 20 --seed 42
 *
 * Output JSON shape: { encounters: SyntheticEdEncounter[] }.
 * No real PHI — every patient_id is SYN-PAT-* and every encounter_external_id
 * is SYN-ENC-*.
 */
import { mkdir, writeFile } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { parseArgs } from 'node:util';
import Anthropic from '@anthropic-ai/sdk';
import { zodOutputFormat } from '@anthropic-ai/sdk/helpers/zod';
import { config } from 'dotenv';
import {
  buildEdUserPrompt,
  EdEncounterBatchSchema,
  SYNTHETIC_ED_ENCOUNTER_SYSTEM_PROMPT,
  type SyntheticEdEncounter,
} from '@/ai/prompts/synthetic-ed-encounters';

config({ path: ['.env.local', '.env'], override: true });

const { values } = parseArgs({
  options: {
    count: { type: 'string', default: '50' },
    seed: { type: 'string', default: String(Date.now() % 100_000) },
    out: { type: 'string', default: 'fixtures/ed-encounters.json' },
  },
});

const count = Number(values.count);
const seed = Number(values.seed);
const outPath = resolve(process.cwd(), values.out ?? 'fixtures/ed-encounters.json');

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
  console.log(`[gen-ed] requesting ${count} synthetic ED encounters (seed=${seed})…`);

  const response = await client.messages.parse({
    model: 'claude-opus-4-7',
    max_tokens: 16_000,
    system: [
      {
        type: 'text',
        text: SYNTHETIC_ED_ENCOUNTER_SYSTEM_PROMPT,
        cache_control: { type: 'ephemeral' },
      },
    ],
    messages: [
      {
        role: 'user',
        content: buildEdUserPrompt(count, seed, new Date().toISOString().slice(0, 10)),
      },
    ],
    output_config: { format: zodOutputFormat(EdEncounterBatchSchema) },
  });

  if (!response.parsed_output) {
    console.error('[gen-ed] structured output parsing failed; stop_reason:', response.stop_reason);
    process.exit(1);
  }
  const { encounters } = response.parsed_output;

  if (encounters.length < count * 0.8) {
    console.warn(
      `[gen-ed] only got ${encounters.length} of ${count} requested — Claude trimmed the batch`,
    );
  }

  const uniquePatients = new Set(encounters.map((e: SyntheticEdEncounter) => e.patient_id));
  console.log(
    `[gen-ed] ${encounters.length} encounters across ${uniquePatients.size} unique patient_ids`,
  );

  await mkdir(dirname(outPath), { recursive: true });
  await writeFile(outPath, `${JSON.stringify({ encounters }, null, 2)}\n`);
  console.log(`[gen-ed] wrote ${outPath}`);
  process.exit(0);
}

main().catch((err) => {
  console.error('[gen-ed] failed', err);
  process.exit(1);
});
