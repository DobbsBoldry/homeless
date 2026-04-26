#!/usr/bin/env tsx
/**
 * Eval harness for the EVDT-012 response-packet generator.
 *
 * Reads fixtures/response-packet-eval.json — 5 hand-curated synthetic
 * filings. Calls Claude on each. Verifies the produced markdown contains
 * the structural elements an attorney expects:
 *
 *   - Disclaimer prefix at the top
 *   - Case caption (court name, plaintiff, defendant, case number)
 *   - At least one numbered response paragraph
 *   - Affirmative defenses checklist (header + at least 5 [ ] items)
 *   - Signature block placeholder
 *
 * This is structural — semantic legal correctness is the attorney's job.
 *
 * Run: pnpm tsx scripts/eval-response-packet.ts
 */
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import Anthropic from '@anthropic-ai/sdk';
import { zodOutputFormat } from '@anthropic-ai/sdk/helpers/zod';
import { config } from 'dotenv';
import {
  buildResponsePacketUserPrompt,
  EVICTION_RESPONSE_PACKET_SYSTEM_PROMPT,
  RESPONSE_PACKET_DISCLAIMER_PREFIX,
  RESPONSE_PACKET_PROMPT_VERSION,
  ResponsePacketSchema,
} from '@/ai/prompts/eviction-response-packet';

config({ path: ['.env.local', '.env'], override: true });

if (!process.env.ANTHROPIC_API_KEY) {
  console.error('ANTHROPIC_API_KEY is not set (check .env.local)');
  process.exit(1);
}

type EvalRow = Parameters<typeof buildResponsePacketUserPrompt>[0];

interface CheckResult {
  name: string;
  ok: boolean;
  detail?: string;
}

function checkPacket(packet: string, row: EvalRow): CheckResult[] {
  const checks: CheckResult[] = [];

  checks.push({
    name: 'disclaimer prefix present',
    ok: packet.includes(RESPONSE_PACKET_DISCLAIMER_PREFIX),
  });

  checks.push({
    name: 'case number in caption',
    ok: packet.includes(row.case_number),
  });

  checks.push({
    name: 'plaintiff in caption',
    ok: packet.includes(row.plaintiff),
  });

  checks.push({
    name: 'defendant in caption',
    ok: packet.includes(row.defendant_name),
  });

  checks.push({
    name: 'has numbered response paragraphs',
    ok: /^\s*\d+\.\s/m.test(packet),
  });

  const checkboxCount = (packet.match(/\[\s*\]/g) ?? []).length;
  checks.push({
    name: 'affirmative defenses checklist (≥5 items)',
    ok: checkboxCount >= 5,
    detail: `found ${checkboxCount} unchecked boxes`,
  });

  checks.push({
    name: 'signature block placeholder',
    ok: /signature/i.test(packet) && /defendant/i.test(packet),
  });

  return checks;
}

async function main() {
  const evalPath = resolve(process.cwd(), 'fixtures/response-packet-eval.json');
  const data = JSON.parse(readFileSync(evalPath, 'utf8')) as { filings: EvalRow[] };
  const client = new Anthropic();

  console.log(
    `[eval] running ${data.filings.length} filings against ${RESPONSE_PACKET_PROMPT_VERSION}`,
  );

  let totalChecks = 0;
  let passedChecks = 0;
  let perfectPackets = 0;

  for (const row of data.filings) {
    const r = await client.messages.parse({
      model: 'claude-opus-4-7',
      max_tokens: 16000,
      thinking: { type: 'adaptive' },
      output_config: {
        effort: 'high',
        format: zodOutputFormat(ResponsePacketSchema),
      },
      system: [
        {
          type: 'text',
          text: EVICTION_RESPONSE_PACKET_SYSTEM_PROMPT,
          cache_control: { type: 'ephemeral' },
        },
      ],
      messages: [{ role: 'user', content: buildResponsePacketUserPrompt(row) }],
    });

    if (!r.parsed_output) {
      console.error(`[eval] ${row.case_number}: no parsed output (stop_reason=${r.stop_reason})`);
      continue;
    }

    const checks = checkPacket(r.parsed_output.packet_md, row);
    const passed = checks.filter((c) => c.ok).length;
    totalChecks += checks.length;
    passedChecks += passed;
    if (passed === checks.length) perfectPackets += 1;

    const verdict = passed === checks.length ? '✓' : '✗';
    console.log(`[eval] ${verdict} ${row.case_number}: ${passed}/${checks.length} checks`);
    for (const c of checks.filter((c) => !c.ok)) {
      console.log(`         ✗ ${c.name}${c.detail ? ` — ${c.detail}` : ''}`);
    }
  }

  const overallPct = (passedChecks / totalChecks) * 100;
  console.log(
    `\n[eval] overall: ${passedChecks}/${totalChecks} checks (${overallPct.toFixed(1)}%) — ${perfectPackets}/${data.filings.length} packets fully clean`,
  );
  process.exit(0);
}

main().catch((err) => {
  console.error('[eval] failed', err);
  process.exit(1);
});
