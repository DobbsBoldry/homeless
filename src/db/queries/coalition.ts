import { asc, eq } from 'drizzle-orm';
import { db } from '@/db/client';
import { type PartnerOrg, partnerOrgs } from '@/db/schema/partner-orgs';

/** All active partner orgs, sorted by type then name. */
export async function listPartnerOrgs(): Promise<PartnerOrg[]> {
  return await db
    .select()
    .from(partnerOrgs)
    .where(eq(partnerOrgs.active, true))
    .orderBy(asc(partnerOrgs.type), asc(partnerOrgs.name));
}
