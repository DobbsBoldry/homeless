import { desc, eq } from 'drizzle-orm';
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
