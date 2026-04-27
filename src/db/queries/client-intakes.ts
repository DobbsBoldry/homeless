import { desc, eq } from 'drizzle-orm';
import { db } from '@/db/client';
import { type ClientIntake, clientIntakes } from '@/db/schema/client-intakes';

export async function listClientIntakes(limit = 50): Promise<ClientIntake[]> {
  return await db.select().from(clientIntakes).orderBy(desc(clientIntakes.createdAt)).limit(limit);
}

export async function getClientIntakeById(id: string): Promise<ClientIntake | null> {
  const [row] = await db.select().from(clientIntakes).where(eq(clientIntakes.id, id)).limit(1);
  return row ?? null;
}
