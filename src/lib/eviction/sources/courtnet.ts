import type { DocketSource, RawFiling } from './types';

/**
 * Real CourtNet source — STUB.
 *
 * Switching from the mock requires:
 * 1. CourtNet 2.0 access via a sponsoring KY-licensed attorney
 *    (see docs/research/ky-courtnet-access.md for the recommended path)
 * 2. AOC sign-off on scripted access from the attorney's account
 * 3. Read of the KCOJ Terms of Use PDF for any anti-automation clauses
 *
 * Until those land, this returns an empty docket. Setting EVICTION_SOURCE=courtnet
 * in production currently means "no new filings ingested" — by design, so an
 * accidental switch can't pollute the database with empty results that look
 * like real data.
 *
 * FIXME(EVDT-001/002): when this stub starts returning real rows, the
 * parser at src/lib/eviction/parser.ts gates on source ∈ {synthetic,
 * manual} and will emit "unsupported source: courtnet" for every row
 * (parse_errors -> 100%). Either drop that gate (the SyntheticSourceSchema
 * shape likely fits a normalized courtnet row) or add a courtnet-specific
 * RawSchema. Verify before flipping EVICTION_SOURCE=courtnet in prod.
 */
class CourtnetSource implements DocketSource {
  readonly source = 'courtnet' as const;
  readonly name = 'courtnet (KCOJ guest portal — STUB until EVDT-001/002 close out)';

  async fetchTodaysDocket(): Promise<RawFiling[]> {
    console.warn(
      '[courtnet] STUB returning empty docket — see docs/research/ky-courtnet-access.md',
    );
    return [];
  }
}

export const courtnet = new CourtnetSource();
