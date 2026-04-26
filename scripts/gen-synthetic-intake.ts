#!/usr/bin/env tsx
/**
 * Generate synthetic shelter-intake conversations via Claude API.
 *
 * Usage:
 *   pnpm tsx scripts/gen-synthetic-intake.ts --count 20 --out fixtures/intakes.json
 *   pnpm tsx scripts/gen-synthetic-intake.ts --count 5 --seed 7 --out fixtures/sample.json
 *
 * - Requires ANTHROPIC_API_KEY in env.
 * - Output JSON shape: { intakes: SyntheticIntake[] } per IntakeBatchSchema.
 * - All names + addresses are clearly synthetic (see prompt).
 * - Token cost scales linearly with count — 20 transcripts ≈ 30K output tokens.
 */
import { mkdir, writeFile } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { parseArgs } from 'node:util';
import Anthropic from '@anthropic-ai/sdk';
import { zodOutputFormat } from '@anthropic-ai/sdk/helpers/zod';
import { config } from 'dotenv';
import {
  buildIntakeUserPrompt,
  IntakeBatchSchema,
  SYNTHETIC_INTAKE_SYSTEM_PROMPT,
  type SyntheticIntake,
} from '@/ai/prompts/synthetic-intake';

// override:true so .env.local wins over shell-preset empty values
// (Claude Code injects an empty ANTHROPIC_API_KEY in some setups).
config({ path: ['.env.local', '.env'], override: true });

const { values } = parseArgs({
  options: {
    count: { type: 'string', default: '5' },
    seed: { type: 'string', default: String(Date.now() % 100_000) },
    out: { type: 'string', default: 'fixtures/intakes.json' },
  },
});

const count = Number(values.count);
const seed = Number(values.seed);
const outPath = resolve(process.cwd(), values.out);

if (!Number.isFinite(count) || count <= 0 || count > 50) {
  console.error('--count must be a positive integer ≤ 50 (each transcript is large)');
  process.exit(1);
}
if (!process.env.ANTHROPIC_API_KEY) {
  console.error('ANTHROPIC_API_KEY is not set (check .env.local)');
  process.exit(1);
}

async function main() {
  const client = new Anthropic();
  console.log(`[gen-intake] requesting ${count} synthetic intakes (seed=${seed})…`);

  // Streaming required because intake transcripts are long — 20 records
  // can exceed 30K output tokens, well past the SDK's non-streaming threshold.
  const stream = client.messages.stream({
    model: 'claude-opus-4-7',
    max_tokens: 64_000,
    system: [
      {
        type: 'text',
        text: SYNTHETIC_INTAKE_SYSTEM_PROMPT,
        cache_control: { type: 'ephemeral' },
      },
    ],
    messages: [
      {
        role: 'user',
        content: buildIntakeUserPrompt(count, seed, new Date().toISOString().slice(0, 10)),
      },
    ],
    output_config: { format: zodOutputFormat(IntakeBatchSchema) },
  });

  const finalMessage = await stream.finalMessage();
  const textBlock = finalMessage.content.find((b) => b.type === 'text');
  if (!textBlock || textBlock.type !== 'text') {
    console.error('[gen-intake] no text block in response; stop_reason:', finalMessage.stop_reason);
    process.exit(1);
  }

  let parsed: { intakes: SyntheticIntake[] };
  try {
    parsed = IntakeBatchSchema.parse(JSON.parse(textBlock.text));
  } catch (err) {
    console.error('[gen-intake] failed to parse model output:', err);
    process.exit(1);
  }

  console.log(`[gen-intake] received ${parsed.intakes.length} intakes`);
  console.log(
    `[gen-intake] tokens: input=${finalMessage.usage.input_tokens}` +
      ` cached_read=${finalMessage.usage.cache_read_input_tokens ?? 0}` +
      ` output=${finalMessage.usage.output_tokens}`,
  );

  await mkdir(dirname(outPath), { recursive: true });
  await writeFile(
    outPath,
    JSON.stringify(
      {
        generated_at: new Date().toISOString(),
        seed,
        count: parsed.intakes.length,
        intakes: parsed.intakes,
      },
      null,
      2,
    ),
  );
  console.log(`[gen-intake] wrote ${outPath}`);
}

main().catch((err) => {
  console.error('[gen-intake] failed', err);
  process.exit(1);
});
