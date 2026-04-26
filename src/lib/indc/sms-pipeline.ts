import { activeBedHoldCounts, listActiveShelters } from '@/db/queries/shelters';
import { findOpenBeds } from './bed-finder';
import { formatBedResults, smsHelp, smsStop, smsUnknown } from './sms-formatter';
import { parseSmsCommand } from './sms-parser';

export type SmsHandleResult = {
  /** Reply body to return to the caller (≤ SMS_MAX_LEN). */
  reply: string;
  /** What kind of intent we recognized; useful for logs / tests. */
  intent: 'bed' | 'help' | 'stop' | 'unknown';
};

/**
 * End-to-end "inbound message text → reply text" function. Pulls live
 * shelter + hold data from the DB; pure-ish in that everything else is
 * deterministic given that data.
 */
export async function handleInboundSms(body: string): Promise<SmsHandleResult> {
  const cmd = parseSmsCommand(body);
  if (cmd.kind === 'help') return { reply: smsHelp(), intent: 'help' };
  if (cmd.kind === 'stop') return { reply: smsStop(), intent: 'stop' };
  if (cmd.kind === 'unknown') return { reply: smsUnknown(), intent: 'unknown' };

  const [shelters, holdCounts] = await Promise.all([listActiveShelters(), activeBedHoldCounts()]);
  const matches = findOpenBeds({
    shelters,
    activeHoldsByShelter: holdCounts,
    filter: cmd.filter,
  });
  return { reply: formatBedResults(matches, cmd.filter), intent: 'bed' };
}
