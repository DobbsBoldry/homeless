import { activeBedHoldCounts, listActiveShelters } from '@/db/queries/shelters';
import { type BedFilter, effectiveFreeBeds, matchesFilter } from '@/lib/coordination';
import { type BedFinderResult, findOpenBeds } from './bed-finder';
import { summarizeBeds } from './bed-summary';
import { createBedHoldFromSms, releaseBedHoldFromSms } from './sms-bed-holds';
import {
  clearConversation,
  getConversation,
  isLocationSkip,
  markIdle,
  normalizeLocation,
  setAwaitingLocation,
  setLastHoldId,
} from './sms-conversation';
import {
  formatBedResults,
  smsBedSummary,
  smsFood,
  smsHelp,
  smsHoldConfirmed,
  smsHoldFailed,
  smsHoldReleased,
  smsLocationPrompt,
  smsNoActiveHold,
  smsNoHoldContext,
  smsStop,
  smsStory,
  smsUnknown,
} from './sms-formatter';
import { parseSmsCommand } from './sms-parser';

export type SmsHandleIntent =
  | 'bed_results'
  | 'bed_summary'
  | 'awaiting_location'
  | 'location_received'
  | 'help'
  | 'stop'
  | 'food'
  | 'story'
  | 'hold_confirmed'
  | 'hold_failed'
  | 'release_confirmed'
  | 'release_failed'
  | 'unknown'
  | 'error';

export type SmsHandleResult = {
  /** Reply body to return to the caller (≤ SMS_MAX_LEN). */
  reply: string;
  /** What kind of intent we recognized; useful for logs / tests. */
  intent: SmsHandleIntent;
};

async function bedResults(
  filter: BedFilter,
  nearLocation: string | null,
): Promise<{ reply: string; results: BedFinderResult[] }> {
  const [shelters, holdCounts] = await Promise.all([listActiveShelters(), activeBedHoldCounts()]);
  const matches = findOpenBeds({ shelters, activeHoldsByShelter: holdCounts, filter });
  return { reply: formatBedResults(matches, filter, nearLocation), results: matches };
}

/**
 * Stateful end-to-end SMS handler. The `fromNumber` keys the conversation
 * state so multi-turn flows ("BED FAMILY" → "where are you?" → "42301"
 * → results, then HOLD <#> against the result list) work correctly.
 * Pass an empty fromNumber to disable conversation state (playground).
 */
export async function handleInboundSmsForNumber(
  fromNumber: string,
  body: string,
): Promise<SmsHandleResult> {
  const cmd = parseSmsCommand(body);
  const stateful = Boolean(fromNumber && fromNumber.trim().length > 0);

  if (cmd.kind === 'help') {
    if (stateful) await clearConversation(fromNumber);
    return { reply: smsHelp(), intent: 'help' };
  }
  if (cmd.kind === 'stop') {
    if (stateful) await clearConversation(fromNumber);
    return { reply: smsStop(), intent: 'stop' };
  }
  if (cmd.kind === 'food') return { reply: smsFood(), intent: 'food' };
  if (cmd.kind === 'story') return { reply: smsStory(), intent: 'story' };

  // STATUS / BOARD / SUMMARY (COOR-006): one-shot dashboard. Stateless
  // even when fromNumber is set — dispatchers wouldn't expect their
  // BED conversation context to evaporate just because they checked
  // the board, so we don't touch existing conversation state.
  if (cmd.kind === 'status') {
    const [shelters, holdCounts] = await Promise.all([listActiveShelters(), activeBedHoldCounts()]);
    const summary = summarizeBeds(shelters, holdCounts);
    return { reply: smsBedSummary(summary), intent: 'bed_summary' };
  }

  // Stateful BED command: park the filter and ask for location.
  if (cmd.kind === 'bed' && stateful) {
    await setAwaitingLocation(fromNumber, cmd.filter);
    return { reply: smsLocationPrompt(), intent: 'awaiting_location' };
  }

  // Stateless BED (playground): immediate results, no location prompt.
  if (cmd.kind === 'bed') {
    const { reply } = await bedResults(cmd.filter, null);
    return { reply, intent: 'bed_results' };
  }

  if (cmd.kind === 'hold' && stateful) {
    return await handleHold(fromNumber, cmd.resultIndex);
  }

  if (cmd.kind === 'release' && stateful) {
    return await handleRelease(fromNumber);
  }

  // From here cmd.kind === 'unknown' (or hold/release in stateless mode).
  if (!stateful) {
    return { reply: smsUnknown(), intent: 'unknown' };
  }

  const convo = await getConversation(fromNumber);
  if (cmd.kind === 'unknown' && convo?.state === 'awaiting_location' && convo.pendingFilter) {
    const nearLocation = isLocationSkip(body) ? null : normalizeLocation(body);
    const { reply, results } = await bedResults(convo.pendingFilter, nearLocation);
    await markIdle(fromNumber, {
      capturedLocation: nearLocation,
      lastResults: results.map((r) => ({ shelterId: r.shelter.id, name: r.shelter.name })),
    });
    return { reply, intent: 'location_received' };
  }

  return { reply: smsUnknown(), intent: 'unknown' };
}

async function handleHold(fromNumber: string, resultIndex: number): Promise<SmsHandleResult> {
  const convo = await getConversation(fromNumber);
  const list = convo?.lastResults ?? [];
  if (list.length === 0) {
    return { reply: smsNoHoldContext(), intent: 'hold_failed' };
  }
  const target = list[Math.max(0, Math.min(resultIndex, list.length - 1))];
  if (!target) {
    return { reply: smsNoHoldContext(), intent: 'hold_failed' };
  }
  // Re-verify there's still an open bed against current data, since
  // the list might be a few minutes stale by the time HOLD arrives.
  const [shelters, holdCounts] = await Promise.all([listActiveShelters(), activeBedHoldCounts()]);
  const shelter = shelters.find((s) => s.id === target.shelterId);
  if (!shelter) {
    return { reply: smsHoldFailed('that shelter is no longer listed.'), intent: 'hold_failed' };
  }
  const free = effectiveFreeBeds(shelter, holdCounts.get(shelter.id) ?? 0);
  if (free <= 0 || !matchesFilter(shelter, { minFreeBeds: 1 })) {
    return {
      reply: smsHoldFailed(`${shelter.name} just filled up.`),
      intent: 'hold_failed',
    };
  }

  const created = await createBedHoldFromSms(target.shelterId, fromNumber);
  if (!created.ok) {
    return { reply: smsHoldFailed(`${created.error}.`), intent: 'hold_failed' };
  }
  await setLastHoldId(fromNumber, created.holdId);
  return {
    reply: smsHoldConfirmed(shelter.name, shelter.contactPhone, created.expiresAt),
    intent: 'hold_confirmed',
  };
}

async function handleRelease(fromNumber: string): Promise<SmsHandleResult> {
  const convo = await getConversation(fromNumber);
  const lastHoldId = convo?.lastHoldId;
  if (!lastHoldId) return { reply: smsNoActiveHold(), intent: 'release_failed' };

  const released = await releaseBedHoldFromSms(lastHoldId);
  if (!released.ok) {
    return { reply: smsNoActiveHold(), intent: 'release_failed' };
  }
  await setLastHoldId(fromNumber, null);
  return { reply: smsHoldReleased(released.shelterName), intent: 'release_confirmed' };
}

/**
 * Stateless variant — used by the admin playground so testing the
 * formatter doesn't pollute real users' conversation state.
 */
export async function handleInboundSms(body: string): Promise<SmsHandleResult> {
  return handleInboundSmsForNumber('', body);
}
