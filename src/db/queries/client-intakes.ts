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

/**
 * Look up the intake spawned by EVDT-CWT bridge referral for a given
 * filing, if any. Matches on the literal label token used by
 * referFilingToCaseworkerAction (`EVDT-REF:{filingId}`) so the join
 * is exact and free of collisions.
 */
export async function getReferralIntakeForFiling(filingId: string): Promise<ClientIntake | null> {
  const [row] = await db
    .select()
    .from(clientIntakes)
    .where(eq(clientIntakes.label, `EVDT-REF:${filingId}`))
    .limit(1);
  return row ?? null;
}

/**
 * Symmetric to getReferralIntakeForFiling, for the ESUC→CWT bridge.
 * Match on `ESUC-REF:{patientId}`.
 */
export async function getReferralIntakeForPatient(patientId: string): Promise<ClientIntake | null> {
  const [row] = await db
    .select()
    .from(clientIntakes)
    .where(eq(clientIntakes.label, `ESUC-REF:${patientId}`))
    .limit(1);
  return row ?? null;
}
