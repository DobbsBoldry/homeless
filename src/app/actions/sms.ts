'use server';

import { db } from '@/db/client';
import { smsMessages } from '@/db/schema/sms-messages';
import { requireRole } from '@/lib/auth';
import { handleInboundSms } from '@/lib/indc/sms-pipeline';

export type SimulateSmsResult = {
  ok: true;
  reply: string;
  intent: string;
};

/**
 * Internal-only "what would the SMS reply be?" helper. Runs the same
 * pipeline as the Twilio webhook against a typed-in body, lets staff
 * preview formatting without burning a Twilio segment. Logged like a
 * real inbound message but with synthetic from/to numbers so it's easy
 * to filter out.
 */
export async function simulateInboundSmsAction(body: string): Promise<SimulateSmsResult> {
  const actor = await requireRole(['admin', 'shelter_staff', 'caseworker', 'ed_coordinator']);
  const result = await handleInboundSms(body);

  await db.insert(smsMessages).values({
    fromNumber: `SIMULATED-${actor.id.slice(0, 8)}`,
    toNumber: 'SIMULATED-INBOUND',
    body,
    intent: result.intent,
    replyBody: result.reply,
    metadata: { simulated: true, actorRole: actor.role },
  });

  return { ok: true, reply: result.reply, intent: result.intent };
}
