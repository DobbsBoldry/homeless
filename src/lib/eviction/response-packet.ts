import Anthropic from '@anthropic-ai/sdk';
import { zodOutputFormat } from '@anthropic-ai/sdk/helpers/zod';
import { and, eq } from 'drizzle-orm';
import {
  buildResponsePacketUserPrompt,
  EVICTION_RESPONSE_PACKET_SYSTEM_PROMPT,
  RESPONSE_PACKET_DISCLAIMER_PREFIX,
  RESPONSE_PACKET_PROMPT_VERSION,
  type ResponsePacketOutput,
  ResponsePacketSchema,
} from '@/ai/prompts/eviction-response-packet';
import { db } from '@/db/client';
import type { EvictionFiling } from '@/db/schema/eviction-filings';
import {
  type EvictionResponsePacket,
  evictionResponsePackets,
  type NewEvictionResponsePacket,
} from '@/db/schema/eviction-response-packets';

let _client: Anthropic | null = null;
function client(): Anthropic {
  if (!_client) _client = new Anthropic();
  return _client;
}

/**
 * Project a filing into the prompt input. Defendant ADDRESS is dropped
 * (the model never sees it) — defendant NAME stays because it appears
 * on the answer caption. CLAUDE.md PHI fence is satisfied by construction.
 */
function scrubForPrompt(filing: EvictionFiling) {
  return {
    case_number: filing.caseNumber,
    court_division: filing.courtDivision,
    plaintiff: filing.plaintiff,
    defendant_name: `${filing.defendantFirstName} ${filing.defendantLastName}`.trim(),
    cause_type: filing.causeType,
    amount_claimed_cents: filing.amountClaimedCents,
    status: filing.status,
    filed_at: filing.filedAt.toISOString(),
  };
}

function fillDisclaimer(packet: string, generatedAt: Date): string {
  return packet
    .replace(/\{timestamp\}/g, generatedAt.toISOString())
    .replace(/\{model_version\}/g, RESPONSE_PACKET_PROMPT_VERSION);
}

/**
 * Single source of truth for the disclaimer-block contract. Used both
 * after generation (placeholder form, before fill) and on attorney save
 * (filled form). Pass `phase` so the right post-fill fragment is checked.
 *
 * Returns ok+error rather than throwing so server actions can surface
 * the message to the user; the generator wraps in throw().
 */
export function validateDisclaimer(
  packetMd: string,
  phase: 'generation' | 'edit',
): { ok: true } | { ok: false; error: string } {
  const required = [
    `${RESPONSE_PACKET_DISCLAIMER_PREFIX} REQUIRED BEFORE FILING.`,
    'not legal advice',
  ];
  if (phase === 'generation') {
    required.push('Generated {timestamp} model {model_version}.');
  } else {
    // After fillDisclaimer the placeholders are gone but the literal
    // 'Generated ' + ' model ' anchors must remain so the attorney can
    // see when/with-what the draft was produced.
    required.push('Generated ');
    required.push(' model ');
  }
  for (const fragment of required) {
    if (!packetMd.includes(fragment)) {
      return {
        ok: false,
        error: `Disclaimer missing required fragment: "${fragment.slice(0, 60)}${fragment.length > 60 ? '…' : ''}"`,
      };
    }
  }
  return { ok: true };
}

/**
 * Generate (or retrieve) the AI-drafted Answer for a filing. Idempotent:
 * (filing_id, prompt_version) pairs return the cached row instead of
 * re-calling Claude.
 *
 * `generatedByUserId` is the attorney who clicked the button — recorded
 * for audit and so we can show "drafted on behalf of {name}" in the UI.
 * Pass `null` for system-triggered generation (e.g. eval harness).
 */
export async function generateResponsePacket(
  filing: EvictionFiling,
  generatedByUserId: string | null,
): Promise<EvictionResponsePacket> {
  const cached = await db
    .select()
    .from(evictionResponsePackets)
    .where(
      and(
        eq(evictionResponsePackets.filingId, filing.id),
        eq(evictionResponsePackets.promptVersion, RESPONSE_PACKET_PROMPT_VERSION),
      ),
    )
    .limit(1);
  if (cached.length > 0) return cached[0];

  const inputs = scrubForPrompt(filing);

  const response = await client().messages.parse({
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
    messages: [{ role: 'user', content: buildResponsePacketUserPrompt(inputs) }],
  });

  if (!response.parsed_output) {
    throw new Error(
      `[response-packet] structured output parse failed; stop_reason=${response.stop_reason}`,
    );
  }
  const parsed: ResponsePacketOutput = response.parsed_output;

  const generationCheck = validateDisclaimer(parsed.packet_md, 'generation');
  if (!generationCheck.ok) {
    throw new Error(`[response-packet] ${generationCheck.error}`);
  }

  const filledPacket = fillDisclaimer(parsed.packet_md, new Date());

  // Belt-and-braces: after filling, both placeholders must be gone.
  // If the model self-substituted a timestamp or version string, fill
  // wouldn't fire and the packet would carry a misleading value.
  if (filledPacket.includes('{timestamp}') || filledPacket.includes('{model_version}')) {
    throw new Error('[response-packet] disclaimer placeholders still present after fill');
  }

  const newRow: NewEvictionResponsePacket = {
    filingId: filing.id,
    packetMd: filledPacket,
    promptVersion: RESPONSE_PACKET_PROMPT_VERSION,
    generatedByUserId,
    status: 'draft',
  };

  const [persisted] = await db
    .insert(evictionResponsePackets)
    .values(newRow)
    .onConflictDoNothing({
      target: [evictionResponsePackets.filingId, evictionResponsePackets.promptVersion],
    })
    .returning();
  if (persisted) return persisted;

  // Concurrent caller beat us — re-select the winner.
  const [winner] = await db
    .select()
    .from(evictionResponsePackets)
    .where(
      and(
        eq(evictionResponsePackets.filingId, filing.id),
        eq(evictionResponsePackets.promptVersion, RESPONSE_PACKET_PROMPT_VERSION),
      ),
    )
    .limit(1);
  return winner;
}

export async function getResponsePacket(filingId: string): Promise<EvictionResponsePacket | null> {
  const rows = await db
    .select()
    .from(evictionResponsePackets)
    .where(
      and(
        eq(evictionResponsePackets.filingId, filingId),
        eq(evictionResponsePackets.promptVersion, RESPONSE_PACKET_PROMPT_VERSION),
      ),
    )
    .limit(1);
  return rows[0] ?? null;
}
