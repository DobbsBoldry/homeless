import { activeBedHoldCounts, listActiveShelters } from '@/db/queries/shelters';
import type { BedFilter } from '@/lib/coordination/bed-availability';
import { findOpenBeds } from './bed-finder';
import {
  clearConversation,
  getConversation,
  isLocationSkip,
  markIdle,
  normalizeLocation,
  setAwaitingLocation,
} from './sms-conversation';
import { formatBedResults, smsHelp, smsLocationPrompt, smsStop, smsUnknown } from './sms-formatter';
import { parseSmsCommand } from './sms-parser';

export type SmsHandleResult = {
  /** Reply body to return to the caller (≤ SMS_MAX_LEN). */
  reply: string;
  /** What kind of intent we recognized; useful for logs / tests. */
  intent:
    | 'bed_results'
    | 'awaiting_location'
    | 'help'
    | 'stop'
    | 'unknown'
    | 'location_received'
    | 'error';
};

async function bedResults(filter: BedFilter, nearLocation: string | null): Promise<string> {
  const [shelters, holdCounts] = await Promise.all([listActiveShelters(), activeBedHoldCounts()]);
  const matches = findOpenBeds({ shelters, activeHoldsByShelter: holdCounts, filter });
  return formatBedResults(matches, filter, nearLocation);
}

/**
 * Stateful end-to-end SMS handler. The `fromNumber` keys the conversation
 * state so multi-turn flows ("BED FAMILY" → "where are you?" → "42301"
 * → results) work correctly. Pass an anonymous / empty fromNumber to
 * disable conversation state (the playground uses this — it operates
 * stateless against the same logic).
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

  // Stateful BED command: park the filter and ask for location.
  if (cmd.kind === 'bed' && stateful) {
    await setAwaitingLocation(fromNumber, cmd.filter);
    return { reply: smsLocationPrompt(), intent: 'awaiting_location' };
  }

  // Stateless BED (playground): immediate results, no location prompt.
  if (cmd.kind === 'bed') {
    return { reply: await bedResults(cmd.filter, null), intent: 'bed_results' };
  }

  // From here cmd.kind === 'unknown'. Conversation context decides
  // whether the body is a location reply or a true unknown.
  if (!stateful) {
    return { reply: smsUnknown(), intent: 'unknown' };
  }

  const convo = await getConversation(fromNumber);
  if (convo?.state === 'awaiting_location' && convo.pendingFilter) {
    const nearLocation = isLocationSkip(body) ? null : normalizeLocation(body);
    const reply = await bedResults(convo.pendingFilter, nearLocation);
    await markIdle(fromNumber, nearLocation);
    return { reply, intent: 'location_received' };
  }

  return { reply: smsUnknown(), intent: 'unknown' };
}

/**
 * Stateless variant — used by the admin playground so testing the
 * formatter doesn't pollute real users' conversation state.
 */
export async function handleInboundSms(body: string): Promise<SmsHandleResult> {
  return handleInboundSmsForNumber('', body);
}
