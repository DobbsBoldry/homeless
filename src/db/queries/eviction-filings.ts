import { desc, eq } from 'drizzle-orm';
import { db } from '@/db/client';
import type { EvictionFilingSource } from '@/db/schema/enums';
import { type EvictionFiling, evictionFilings } from '@/db/schema/eviction-filings';

/**
 * Fetch the most recent N filings, ordered by filed_at desc.
 * Optional filter on source (synthetic / manual / courtnet) for the dashboard
 * source-pill control.
 */
export async function listRecentFilings(
  opts: { limit?: number; source?: EvictionFilingSource } = {},
): Promise<EvictionFiling[]> {
  const { limit = 50, source } = opts;
  const base = db.select().from(evictionFilings);
  const filtered = source ? base.where(eq(evictionFilings.source, source)) : base;
  return await filtered.orderBy(desc(evictionFilings.filedAt)).limit(limit);
}
