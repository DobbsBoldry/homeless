import { sql } from 'drizzle-orm';
import { db } from '@/db/client';
import { smsMessages } from '@/db/schema/sms-messages';

export type DailyIntentCount = {
  /** UTC date string `YYYY-MM-DD`. */
  day: string;
  intent: string;
  count: number;
};

export type IntentTotal = { intent: string; count: number };

/**
 * Aggregate inbound message counts by UTC day × intent for the last
 * `windowDays` days. Phone numbers are NEVER returned by this query —
 * the dashboard built on top of it is volume-tracking, not surveillance.
 *
 * The simulated playground messages (from_number prefixed
 * "SIMULATED-") are excluded so dashboard counts reflect real traffic.
 */
export async function dailyIntentCounts(windowDays = 7): Promise<DailyIntentCount[]> {
  const rows = await db.execute(sql`
    SELECT
      to_char(date_trunc('day', received_at AT TIME ZONE 'UTC'), 'YYYY-MM-DD') AS day,
      intent,
      COUNT(*)::int AS count
    FROM ${smsMessages}
    WHERE received_at >= now() - (${windowDays} || ' days')::interval
      AND from_number NOT LIKE 'SIMULATED-%'
    GROUP BY 1, 2
    ORDER BY 1 ASC, 2 ASC
  `);
  return (rows as unknown as Array<{ day: string; intent: string; count: number }>).map((r) => ({
    day: r.day,
    intent: r.intent,
    count: Number(r.count),
  }));
}

/**
 * Intent totals across the window. Useful for the headline pie/list:
 * "of 142 messages this week, 87 were BED, 12 HELP, 4 STOP, 39 unknown".
 */
export async function intentTotals(windowDays = 7): Promise<IntentTotal[]> {
  const rows = await db.execute(sql`
    SELECT intent, COUNT(*)::int AS count
    FROM ${smsMessages}
    WHERE received_at >= now() - (${windowDays} || ' days')::interval
      AND from_number NOT LIKE 'SIMULATED-%'
    GROUP BY 1
    ORDER BY count DESC, intent ASC
  `);
  return (rows as unknown as Array<{ intent: string; count: number }>).map((r) => ({
    intent: r.intent,
    count: Number(r.count),
  }));
}

/**
 * Count of distinct phone numbers seen in the window. Phone numbers
 * never leave this query — only the count does.
 */
export async function uniqueCallerCount(windowDays = 7): Promise<number> {
  const rows = await db.execute(sql`
    SELECT COUNT(DISTINCT from_number)::int AS count
    FROM ${smsMessages}
    WHERE received_at >= now() - (${windowDays} || ' days')::interval
      AND from_number NOT LIKE 'SIMULATED-%'
  `);
  const first = (rows as unknown as Array<{ count: number }>)[0];
  return first ? Number(first.count) : 0;
}

/**
 * Lightweight last-N "what just happened" feed for admin debugging.
 * Phone numbers are returned redacted to last-4 ("…4567") so the page
 * doesn't accidentally surface PII.
 */
export type RecentRedactedMessage = {
  id: string;
  receivedAt: Date;
  fromLast4: string;
  intent: string;
  bodyExcerpt: string;
};

export async function recentRedactedMessages(limit = 20): Promise<RecentRedactedMessage[]> {
  const rows = await db
    .select({
      id: smsMessages.id,
      receivedAt: smsMessages.receivedAt,
      fromNumber: smsMessages.fromNumber,
      intent: smsMessages.intent,
      body: smsMessages.body,
    })
    .from(smsMessages)
    .orderBy(sql`${smsMessages.receivedAt} DESC`)
    .limit(limit);
  return rows.map((r) => {
    const digits = r.fromNumber.replace(/[^0-9]/g, '');
    const last4 = digits.slice(-4) || '----';
    const bodyExcerpt = r.body.length > 80 ? `${r.body.slice(0, 77)}…` : r.body;
    return {
      id: r.id,
      receivedAt: new Date(r.receivedAt),
      fromLast4: last4,
      intent: r.intent,
      bodyExcerpt,
    };
  });
}
