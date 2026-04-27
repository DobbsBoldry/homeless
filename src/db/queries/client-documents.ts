import { desc, eq } from 'drizzle-orm';
import { db } from '@/db/client';
import { type ClientDocument, clientDocuments } from '@/db/schema/client-documents';

export async function listClientDocuments(limit = 50): Promise<ClientDocument[]> {
  return await db
    .select()
    .from(clientDocuments)
    .orderBy(desc(clientDocuments.createdAt))
    .limit(limit);
}

export async function getClientDocumentById(id: string): Promise<ClientDocument | null> {
  const [row] = await db.select().from(clientDocuments).where(eq(clientDocuments.id, id)).limit(1);
  return row ?? null;
}
