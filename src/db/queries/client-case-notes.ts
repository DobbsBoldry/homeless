import { desc, eq } from 'drizzle-orm';
import { db } from '@/db/client';
import { type ClientCaseNote, clientCaseNotes } from '@/db/schema/client-case-notes';

export async function listCaseNotesForPerson(
  syntheticPersonRef: string,
): Promise<ClientCaseNote[]> {
  return await db
    .select()
    .from(clientCaseNotes)
    .where(eq(clientCaseNotes.syntheticPersonRef, syntheticPersonRef))
    .orderBy(desc(clientCaseNotes.createdAt));
}

export async function getCaseNoteById(id: string): Promise<ClientCaseNote | null> {
  const [row] = await db.select().from(clientCaseNotes).where(eq(clientCaseNotes.id, id)).limit(1);
  return row ?? null;
}
