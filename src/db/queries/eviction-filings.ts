import { and, desc, eq, gte, ilike, or, type SQL, sql } from 'drizzle-orm';
import { RISK_SCORE_MODEL_VERSION } from '@/ai/prompts/eviction-risk-score';
import { db } from '@/db/client';
import type {
  EvictionCauseType,
  EvictionFilingSource,
  EvictionFilingStatus,
  UserRole,
} from '@/db/schema/enums';
import { evictionFilingRiskScores } from '@/db/schema/eviction-filing-risk-scores';
import { type EvictionFiling, evictionFilings } from '@/db/schema/eviction-filings';
import { redactAddress, viewerCanSeeDvAddresses } from '@/lib/dtrs/dv-blind';
import type { RankedDocketRow } from '@/lib/eviction/docket-ranking';

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

/** Single filing by primary key. Returns null if not found. */
export async function getFilingById(id: string): Promise<EvictionFiling | null> {
  const rows = await db.select().from(evictionFilings).where(eq(evictionFilings.id, id)).limit(1);
  return rows[0] ?? null;
}

/**
 * Viewer-aware variants — DTRS-004 redaction baked into the query
 * layer (issue #268). Every consumer of these helpers gets a row
 * whose address fields are either real or `LOCATION_REDACTED`,
 * decided server-side based on the caller's role and the row's
 * `dv_flag`. New surfaces that fetch through these are safe by
 * construction. The raw helpers above remain available for
 * audit / admin use cases that need the un-redacted row.
 */
export async function getFilingByIdForViewer(
  id: string,
  viewerRole: UserRole,
): Promise<EvictionFiling | null> {
  const row = await getFilingById(id);
  if (!row) return null;
  const redact = row.dvFlag && !viewerCanSeeDvAddresses(viewerRole);
  return redactAddress(row, redact);
}

export async function listRecentFilingsForViewer(
  opts: { limit?: number; source?: EvictionFilingSource },
  viewerRole: UserRole,
): Promise<EvictionFiling[]> {
  const rows = await listRecentFilings(opts);
  if (viewerCanSeeDvAddresses(viewerRole)) return rows;
  return rows.map((f) => (f.dvFlag ? redactAddress(f, true) : f));
}

/**
 * KLA daily docket: every filing joined to its risk score for the current
 * model version, ordered by (score DESC, filed_at DESC). Unscored filings
 * are included and rank last (COALESCE score = 0).
 *
 * Restricting the join to RISK_SCORE_MODEL_VERSION guarantees one score row
 * per filing (model_version is part of the unique index), so no fan-out.
 * When a new model_version ships, this query continues returning the
 * current-version score; old-version rows are ignored — exactly the
 * eval-comparison semantics described in the schema.
 */
export interface ListRankedDocketOpts {
  limit?: number;
  status?: EvictionFilingStatus;
  cause?: EvictionCauseType;
  /** Inclusive lower bound on score. Filings without a score are excluded when set. */
  minScore?: number;
  /** Substring match (case-insensitive) on case_number OR plaintiff. */
  search?: string;
}

export async function listRankedDocket(
  opts: ListRankedDocketOpts = {},
): Promise<RankedDocketRow[]> {
  const { limit = 50, status, cause, minScore, search } = opts;

  const where: SQL[] = [];
  if (status) where.push(eq(evictionFilings.status, status));
  if (cause) where.push(eq(evictionFilings.causeType, cause));
  if (typeof minScore === 'number') where.push(gte(evictionFilingRiskScores.score, minScore));
  if (search && search.trim().length > 0) {
    const pattern = `%${search.trim()}%`;
    const orClause = or(
      ilike(evictionFilings.caseNumber, pattern),
      ilike(evictionFilings.plaintiff, pattern),
    );
    if (orClause) where.push(orClause);
  }

  const query = db
    .select({
      filing: evictionFilings,
      score: evictionFilingRiskScores.score,
      rationale: evictionFilingRiskScores.rationale,
    })
    .from(evictionFilings)
    .leftJoin(
      evictionFilingRiskScores,
      and(
        eq(evictionFilingRiskScores.filingId, evictionFilings.id),
        eq(evictionFilingRiskScores.modelVersion, RISK_SCORE_MODEL_VERSION),
      ),
    );
  const filtered = where.length > 0 ? query.where(and(...where)) : query;

  return await filtered
    .orderBy(
      desc(sql`COALESCE(${evictionFilingRiskScores.score}, 0)`),
      desc(evictionFilings.filedAt),
    )
    .limit(limit);
}

/**
 * Viewer-aware ranked docket. Mirrors `listRankedDocket` but redacts
 * the embedded filing address for DV-flagged rows when the viewer
 * lacks the permission. Same shape as the underlying type so the UI
 * doesn't have to branch.
 */
export async function listRankedDocketForViewer(
  opts: ListRankedDocketOpts,
  viewerRole: UserRole,
): Promise<RankedDocketRow[]> {
  const rows = await listRankedDocket(opts);
  if (viewerCanSeeDvAddresses(viewerRole)) return rows;
  return rows.map((r) => (r.filing.dvFlag ? { ...r, filing: redactAddress(r.filing, true) } : r));
}
