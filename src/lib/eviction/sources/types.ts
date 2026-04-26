/**
 * Common interface for any source that produces raw eviction filing records.
 * `RawFiling` is the lowest common denominator — fields the parser knows how
 * to handle. Source-specific extras can ride along; the parser ignores them
 * but they survive into eviction_filings.raw_json.
 */
export interface RawFiling {
  case_number: string;
  filed_at: string;
  court_division?: string | null;
  plaintiff: string;
  defendant_first_name: string;
  defendant_last_name: string;
  defendant_address?: string | null;
  cause_type: 'non_payment' | 'lease_violation' | 'holdover' | 'other';
  amount_claimed_cents?: number | null;
  status: 'filed' | 'served' | 'judgment' | 'dismissed' | 'sealed';
  notes?: string | null;
  attorney_represented?: boolean | null;
}

import type { EvictionFilingSource } from '@/db/schema/enums';

export interface DocketSource {
  /** Source tag stored on each row — drives upsert rank ordering. */
  readonly source: EvictionFilingSource;
  /** Name shown in logs / Inngest run output. */
  readonly name: string;
  /** Pull today's docket. Idempotent — should return the same data on the same day. */
  fetchTodaysDocket(): Promise<RawFiling[]>;
}
