import { desc, eq } from 'drizzle-orm';
import { db } from '@/db/client';
import { type CommsAdvisory, commsAdvisories } from '@/db/schema/comms-advisories';

export async function getActiveCommsAdvisory(): Promise<CommsAdvisory | null> {
  const [row] = await db
    .select()
    .from(commsAdvisories)
    .where(eq(commsAdvisories.active, true))
    .orderBy(desc(commsAdvisories.createdAt))
    .limit(1);
  return row ?? null;
}

export async function listCommsAdvisories(limit = 20): Promise<CommsAdvisory[]> {
  return await db
    .select()
    .from(commsAdvisories)
    .orderBy(desc(commsAdvisories.createdAt))
    .limit(limit);
}

export async function getCommsAdvisoryById(id: string): Promise<CommsAdvisory | null> {
  const [row] = await db.select().from(commsAdvisories).where(eq(commsAdvisories.id, id)).limit(1);
  return row ?? null;
}
