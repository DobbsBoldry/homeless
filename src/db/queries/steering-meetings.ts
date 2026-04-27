import { and, desc, eq, isNotNull, ne } from 'drizzle-orm';
import { db } from '@/db/client';
import { type SteeringMeeting, steeringMeetings } from '@/db/schema/steering-meetings';

export async function listSteeringMeetings(): Promise<SteeringMeeting[]> {
  return await db.select().from(steeringMeetings).orderBy(desc(steeringMeetings.heldOn));
}

export async function getSteeringMeetingById(id: string): Promise<SteeringMeeting | null> {
  const [row] = await db
    .select()
    .from(steeringMeetings)
    .where(eq(steeringMeetings.id, id))
    .limit(1);
  return row ?? null;
}

/**
 * Most recent posted meeting other than `excludeId`. Used by the
 * agenda drafter to surface unfinished business — open action items
 * are the strongest signal for next-meeting topics.
 */
export async function getMostRecentPostedMeeting(
  excludeId: string,
): Promise<SteeringMeeting | null> {
  const [row] = await db
    .select()
    .from(steeringMeetings)
    .where(and(isNotNull(steeringMeetings.postedAt), ne(steeringMeetings.id, excludeId)))
    .orderBy(desc(steeringMeetings.heldOn))
    .limit(1);
  return row ?? null;
}
