/**
 * PRVN-006 — outreach-priorities aggregation engine.
 *
 * Pure function. Aggregates eviction filings by ZIP code over a time
 * window, applies cell-size suppression (per ADR 0003 — "aggregate-only,
 * never identifying"), and returns a ranked list mobile-outreach teams
 * (Catholic Charities and other faith partners) can pre-position
 * against.
 *
 * Why eviction filings (only) for v1: filings are public court records
 * — no PHI, no consent dependency. Adding ED super-utilizer or school-
 * referral signals to the rollup is a future story (each carries its
 * own privacy regime).
 *
 * Why ZIP and not a finer geography: at county-level pilot scale,
 * ZIP gives a usable signal without naming individuals. Block-level or
 * street-level grouping would risk re-identification. Cell-size
 * suppression at the ZIP level is the safety net.
 */

const ZIP_REGEX = /(\d{5})(?:-\d{4})?\s*$/;

/**
 * Extract a 5-digit ZIP from the LAST trailing zip-shaped sequence on
 * the input. Returns null if no zip is present. Conservative: matches
 * only at end-of-string (after possibly-stripping ZIP+4) so 5-digit
 * apartment numbers, phone numbers, etc. don't accidentally match.
 */
export function extractZip(address: string | null | undefined): string | null {
  if (!address) return null;
  const trimmed = address.trim();
  if (!trimmed) return null;
  const m = trimmed.match(ZIP_REGEX);
  return m ? m[1] : null;
}

export type FilingForPriorities = {
  defendantAddress: string | null;
  filedAt: Date;
};

export type OutreachPriority = {
  zip: string;
  count: number;
};

export type OutreachPrioritiesResult = {
  priorities: OutreachPriority[];
  /** Total filings considered (including those that landed in suppressed regions and unknown). */
  totalFilings: number;
  /** How many distinct zips were below the cell-size threshold and dropped from the report. */
  suppressedRegions: number;
  /** Sum of filings inside suppressed regions (audit trail for the suppression). */
  suppressedCount: number;
  /** Filings whose ZIP could not be extracted from the address (always grouped as "unknown"). */
  unknownZipCount: number;
};

export const DEFAULT_OUTREACH_MIN_CELL_SIZE = 5;

export type ComputeOutreachPrioritiesOpts = {
  minCellSize?: number;
};

/**
 * Compute outreach priorities. Pure: no DB, no clocks. Caller picks
 * the time window upstream by filtering `filings` before passing in.
 *
 * Cell-size suppression: any zip with raw count below `minCellSize`
 * is dropped from `priorities` and counted toward `suppressedRegions`
 * + `suppressedCount`. Filings without a parseable zip are tracked
 * as `unknownZipCount` and are never reported as a priority (they're
 * a data-quality signal, not an actionable ZIP).
 */
export function computeOutreachPriorities(
  filings: ReadonlyArray<FilingForPriorities>,
  opts: ComputeOutreachPrioritiesOpts = {},
): OutreachPrioritiesResult {
  const minCellSize = opts.minCellSize ?? DEFAULT_OUTREACH_MIN_CELL_SIZE;

  let unknownZipCount = 0;
  const counts = new Map<string, number>();

  for (const f of filings) {
    const zip = extractZip(f.defendantAddress);
    if (zip === null) {
      unknownZipCount += 1;
      continue;
    }
    counts.set(zip, (counts.get(zip) ?? 0) + 1);
  }

  let suppressedRegions = 0;
  let suppressedCount = 0;
  const reported: OutreachPriority[] = [];

  for (const [zip, count] of counts) {
    if (count < minCellSize) {
      suppressedRegions += 1;
      suppressedCount += count;
      continue;
    }
    reported.push({ zip, count });
  }

  // Rank: count DESC, then zip ASC for deterministic tie-break.
  reported.sort((a, b) => {
    if (a.count !== b.count) return b.count - a.count;
    return a.zip.localeCompare(b.zip);
  });

  return {
    priorities: reported,
    totalFilings: filings.length,
    suppressedRegions,
    suppressedCount,
    unknownZipCount,
  };
}
