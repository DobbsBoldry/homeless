import Anthropic from '@anthropic-ai/sdk';
import { zodOutputFormat } from '@anthropic-ai/sdk/helpers/zod';
import { and, eq } from 'drizzle-orm';
import {
  buildCarePlanUserPrompt,
  CARE_PLAN_DISCLAIMER_PREFIX,
  CARE_PLAN_PROMPT_VERSION,
  type CarePlanOutput,
  CarePlanSchema,
  ESUC_CARE_PLAN_SYSTEM_PROMPT,
} from '@/ai/prompts/esuc-care-plan';
import { db } from '@/db/client';
import { listEncountersForPatient } from '@/db/queries/ed-encounters';
import {
  type EsucCarePlan,
  esucCarePlans,
  type NewEsucCarePlan,
} from '@/db/schema/esuc-care-plans';

let _client: Anthropic | null = null;
function client(): Anthropic {
  if (!_client) _client = new Anthropic();
  return _client;
}

const WINDOW_DAYS = 180;

/**
 * Single source of truth for the care-plan disclaimer contract. Used
 * after generation (placeholder form) and on coordinator save (filled
 * form). Same shape as response-packet.ts validateDisclaimer.
 */
export function validateCarePlanDisclaimer(
  planMd: string,
  phase: 'generation' | 'edit',
): { ok: true } | { ok: false; error: string } {
  const required = [
    `${CARE_PLAN_DISCLAIMER_PREFIX}.`,
    'not a treatment plan',
    'not a clinical recommendation',
  ];
  if (phase === 'generation') {
    required.push('Generated {timestamp} model {model_version}.');
  } else {
    required.push('Generated ');
    required.push(' model ');
  }
  for (const fragment of required) {
    if (!planMd.includes(fragment)) {
      return {
        ok: false,
        error: `Care-plan disclaimer missing required fragment: "${fragment.slice(0, 60)}${fragment.length > 60 ? '…' : ''}"`,
      };
    }
  }
  return { ok: true };
}

/**
 * Defensive scrub of an encounter `notes` field before it enters the
 * Claude prompt. Phase 1: synthetic data, this is mostly a no-op
 * stub. **TODO(ESUC-002):** when Epic FHIR data flows post-BAA,
 * replace with a proper de-identification pipeline (Microsoft Presidio
 * or equivalent — name/address/phone/MRN/email recognition + redaction).
 *
 * Today's stub catches the most blatant patterns so a developer who
 * accidentally pastes a real name into a synthetic fixture gets
 * a "[REDACTED]" in the prompt rather than passing it through.
 */
function scrubClinicalNote(s: string | null): string | null {
  if (!s) return s;
  return (
    s
      // Phone numbers (US-shaped)
      .replace(/\+?1?[\s-]?\(?\d{3}\)?[\s-]?\d{3}[\s-]?\d{4}/g, '[REDACTED-PHONE]')
      // Email-shaped
      .replace(/[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}/g, '[REDACTED-EMAIL]')
      // SSN-shaped
      .replace(/\b\d{3}-\d{2}-\d{4}\b/g, '[REDACTED-SSN]')
      // Honorifics + name
      .replace(
        /\b(Mr|Mrs|Ms|Dr|Mr\.|Mrs\.|Ms\.|Dr\.)\s+[A-Z][a-z]+(?:\s+[A-Z][a-z]+)?/g,
        '[REDACTED-NAME]',
      )
  );
}

function fillDisclaimer(planMd: string, generatedAt: Date): string {
  return planMd
    .replace(/\{timestamp\}/g, generatedAt.toISOString())
    .replace(/\{model_version\}/g, CARE_PLAN_PROMPT_VERSION);
}

/**
 * Generate (or retrieve) the AI-drafted care plan for a patient.
 * Idempotent: (patient_id, prompt_version) pairs return the cached row
 * instead of re-calling Claude.
 *
 * `generatedByUserId` is the care coordinator who clicked the button —
 * recorded for audit and so we can show "drafted on behalf of {name}"
 * in the UI. Pass `null` for system-triggered generation (eval harness).
 */
export async function generateCarePlan(
  patientId: string,
  generatedByUserId: string | null,
): Promise<EsucCarePlan> {
  const cached = await db
    .select()
    .from(esucCarePlans)
    .where(
      and(
        eq(esucCarePlans.patientId, patientId),
        eq(esucCarePlans.promptVersion, CARE_PLAN_PROMPT_VERSION),
      ),
    )
    .limit(1);
  if (cached.length > 0) return cached[0];

  const encounters = await listEncountersForPatient(patientId);
  if (encounters.length === 0) {
    throw new Error(`[care-plan] no encounters for patient ${patientId}; refusing to draft`);
  }

  const promptInput = {
    patient_id: patientId,
    encounter_count: encounters.length,
    window_days: WINDOW_DAYS,
    encounters: encounters.map((e) => ({
      arrived_at: e.arrivedAt.toISOString(),
      chief_complaint: e.chiefComplaint,
      disposition: e.disposition,
      housing_status: e.housingStatus,
      charge_cents: e.chargeCents,
      notes: scrubClinicalNote(e.notes),
    })),
  };

  const response = await client().messages.parse({
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
    messages: [{ role: 'user', content: buildCarePlanUserPrompt(promptInput) }],
  });

  if (!response.parsed_output) {
    throw new Error(
      `[care-plan] structured output parse failed; stop_reason=${response.stop_reason}`,
    );
  }
  const parsed: CarePlanOutput = response.parsed_output;

  const generationCheck = validateCarePlanDisclaimer(parsed.plan_md, 'generation');
  if (!generationCheck.ok) {
    throw new Error(`[care-plan] ${generationCheck.error}`);
  }

  const filled = fillDisclaimer(parsed.plan_md, new Date());

  if (filled.includes('{timestamp}') || filled.includes('{model_version}')) {
    throw new Error('[care-plan] disclaimer placeholders still present after fill');
  }

  const newRow: NewEsucCarePlan = {
    patientId,
    planMd: filled,
    promptVersion: CARE_PLAN_PROMPT_VERSION,
    generatedByUserId,
    status: 'draft',
  };

  const [persisted] = await db
    .insert(esucCarePlans)
    .values(newRow)
    .onConflictDoNothing({
      target: [esucCarePlans.patientId, esucCarePlans.promptVersion],
    })
    .returning();
  if (persisted) return persisted;

  // Concurrent caller beat us — re-select the winner.
  const [winner] = await db
    .select()
    .from(esucCarePlans)
    .where(
      and(
        eq(esucCarePlans.patientId, patientId),
        eq(esucCarePlans.promptVersion, CARE_PLAN_PROMPT_VERSION),
      ),
    )
    .limit(1);
  return winner;
}

export async function getCarePlanByPatient(patientId: string): Promise<EsucCarePlan | null> {
  const rows = await db
    .select()
    .from(esucCarePlans)
    .where(
      and(
        eq(esucCarePlans.patientId, patientId),
        eq(esucCarePlans.promptVersion, CARE_PLAN_PROMPT_VERSION),
      ),
    )
    .limit(1);
  return rows[0] ?? null;
}
