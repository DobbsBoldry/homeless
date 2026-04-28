/**
 * PRVN-006 — outreach-priorities query.
 *
 * Reads eviction_filings (public court records — no PHI, no consent
 * gate) over a window and feeds the pure aggregator in
 * `src/lib/oprt/outreach-priorities.ts`. Returns only the address +
 * filed-at fields needed for ZIP extraction; downstream consumers
 * never see defendant names through this surface.
 */

import { gte } from 'drizzle-orm';
import { db } from '@/db/client';
import { evictionFilings } from '@/db/schema/eviction-filings';
import {
  type ComputeOutreachPrioritiesOpts,
  computeOutreachPriorities,
  type OutreachPrioritiesResult,
} from '@/lib/oprt';

export interface ListOutreachPrioritiesOpts extends ComputeOutreachPrioritiesOpts {
  /** Lookback window in days. Default 30 — outreach acts on recent trends. */
  windowDays?: number;
}

export async function listOutreachPriorities(
  opts: ListOutreachPrioritiesOpts = {},
): Promise<OutreachPrioritiesResult> {
  const { windowDays = 30, ...aggOpts } = opts;
  const since = new Date();
  since.setDate(since.getDate() - windowDays);

  // Defendant name is intentionally NOT selected — this surface is
  // aggregate-only and the renderer must not have access to identifiers.
  const rows = await db
    .select({
      defendantAddress: evictionFilings.defendantAddress,
      filedAt: evictionFilings.filedAt,
    })
    .from(evictionFilings)
    .where(gte(evictionFilings.filedAt, since));

  return computeOutreachPriorities(
    rows.map((r) => ({
      defendantAddress: r.defendantAddress ?? null,
      filedAt: r.filedAt instanceof Date ? r.filedAt : new Date(r.filedAt),
    })),
    aggOpts,
  );
}
