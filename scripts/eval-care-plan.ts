#!/usr/bin/env tsx
/**
 * Eval harness for the ESUC-011 care plan generator. Mirror of
 * eval-response-packet.ts.
 *
 * Reads fixtures/care-plan-eval.json — 5 hand-curated synthetic
 * patients, each with their own encounter history. Calls Claude on
 * each and verifies the rendered markdown contains the structural
 * elements a care coordinator expects.
 *
 * Run: pnpm tsx scripts/eval-care-plan.ts
 *
 * Exits non-zero unless every plan passes every structural check, so
 * a regression is visible without reading the log.
 */
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import Anthropic from '@anthropic-ai/sdk';
import { zodOutputFormat } from '@anthropic-ai/sdk/helpers/zod';
import { config } from 'dotenv';
import {
  buildCarePlanUserPrompt,
  CARE_PLAN_DISCLAIMER_PREFIX,
  CARE_PLAN_PROMPT_VERSION,
  CarePlanSchema,
  ESUC_CARE_PLAN_SYSTEM_PROMPT,
} from '@/ai/prompts/esuc-care-plan';

config({ path: ['.env.local', '.env'], override: true });

if (!process.env.ANTHROPIC_API_KEY) {
  console.error('ANTHROPIC_API_KEY is not set (check .env.local)');
  process.exit(1);
}

type EvalRow = Parameters<typeof buildCarePlanUserPrompt>[0];

interface CheckResult {
  name: string;
  ok: boolean;
  detail?: string;
}

const FORBIDDEN_NAME_PATTERNS = [
  // First+last name patterns Claude might try to invent. Real Epic
  // data should never reach this prompt anyway, but assert defense.
  /\b[A-Z][a-z]{2,}\s+[A-Z][a-z]{2,}\b/, // "John Smith"-shaped
];

function checkPlan(plan: string, row: EvalRow): CheckResult[] {
  const checks: CheckResult[] = [];

  checks.push({
    name: 'disclaimer prefix present',
    ok: plan.includes(CARE_PLAN_DISCLAIMER_PREFIX),
  });

  checks.push({
    name: 'opaque patient_id rendered',
    ok: plan.includes(row.patient_id),
  });

  checks.push({
    name: 'has Patient summary section',
    ok: /^#\s+Patient summary/im.test(plan),
  });

  checks.push({
    name: 'has Risk factors section',
    ok: /^#\s+Risk factors/im.test(plan),
  });

  checks.push({
    name: 'has Recommended interventions section',
    ok: /^#\s+Recommended interventions/im.test(plan),
  });

  const checkboxCount = (plan.match(/\[\s*\]/g) ?? []).length;
  checks.push({
    name: 'interventions checklist (≥5 items)',
    ok: checkboxCount >= 5,
    detail: `found ${checkboxCount} unchecked boxes`,
  });

  checks.push({
    name: 'has TEAMKY HRSN / Recuperative Care note',
    ok: /TEAMKY|HRSN|Recuperative/i.test(plan),
  });

  // Defense in depth: a plan should NOT contain anything that looks
  // like an invented patient name. The forbidden pattern matches the
  // example we put IN the prompt, so we strip the example before
  // checking — but the example case-id (SYN-PAT-009104) won't be
  // in the actual outputs unless Claude copied it.
  const planMinusExample = plan.replace(
    /SYN-PAT-009104[\s\S]*?(end of example\)|# Patient summary)/g,
    '',
  );
  const nameLikely = FORBIDDEN_NAME_PATTERNS.some((re) => re.test(planMinusExample));
  checks.push({
    name: 'no invented name-like strings',
    ok: !nameLikely,
    detail: nameLikely ? 'matched name-shaped pattern' : undefined,
  });

  return checks;
}

async function main() {
  const evalPath = resolve(process.cwd(), 'fixtures/care-plan-eval.json');
  const data = JSON.parse(readFileSync(evalPath, 'utf8')) as { patients: EvalRow[] };
  const client = new Anthropic();

  console.log(
    `[eval] running ${data.patients.length} care plans against ${CARE_PLAN_PROMPT_VERSION}`,
  );

  let totalChecks = 0;
  let passedChecks = 0;
  let perfectPlans = 0;

  for (const row of data.patients) {
    const r = await client.messages.parse({
      model: 'claude-opus-4-7',
      max_tokens: 16000,
      thinking: { type: 'adaptive' },
      output_config: {
        effort: 'high',
        format: zodOutputFormat(CarePlanSchema),
      },
      system: [
        {
          type: 'text',
          text: ESUC_CARE_PLAN_SYSTEM_PROMPT,
          cache_control: { type: 'ephemeral' },
        },
      ],
      messages: [{ role: 'user', content: buildCarePlanUserPrompt(row) }],
    });

    if (!r.parsed_output) {
      console.error(`[eval] ${row.patient_id}: no parsed output (stop=${r.stop_reason})`);
      continue;
    }

    const checks = checkPlan(r.parsed_output.plan_md, row);
    const passed = checks.filter((c) => c.ok).length;
    totalChecks += checks.length;
    passedChecks += passed;
    if (passed === checks.length) perfectPlans += 1;

    const verdict = passed === checks.length ? '✓' : '✗';
    console.log(`[eval] ${verdict} ${row.patient_id}: ${passed}/${checks.length} checks`);
    for (const c of checks.filter((c) => !c.ok)) {
      console.log(`         ✗ ${c.name}${c.detail ? ` — ${c.detail}` : ''}`);
    }
  }

  const overallPct = (passedChecks / totalChecks) * 100;
  console.log(
    `\n[eval] overall: ${passedChecks}/${totalChecks} checks (${overallPct.toFixed(1)}%) — ${perfectPlans}/${data.patients.length} plans fully clean`,
  );
  process.exit(perfectPlans === data.patients.length ? 0 : 1);
}

main().catch((err) => {
  console.error('[eval] failed', err);
  process.exit(1);
});
