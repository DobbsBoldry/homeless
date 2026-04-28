/**
 * PRVN-006 — outreach-priorities tests.
 *
 * Pure function. No DB, no clocks. Verifies zip extraction, cell-size
 * suppression, and ranking deterministically.
 */

import { describe, expect, it } from 'vitest';
import {
  computeOutreachPriorities,
  DEFAULT_OUTREACH_MIN_CELL_SIZE,
  extractZip,
  type FilingForPriorities,
} from './outreach-priorities';

describe('extractZip', () => {
  it('extracts a 5-digit zip from a "Owensboro, KY 42301" address', () => {
    expect(extractZip('123 Main St, Owensboro, KY 42301')).toBe('42301');
  });

  it('extracts a 5-digit zip from a ZIP+4', () => {
    expect(extractZip('123 Main St, Owensboro, KY 42301-1234')).toBe('42301');
  });

  it('returns null when no zip is present', () => {
    expect(extractZip('123 Main St, Owensboro, KY')).toBeNull();
  });

  it('returns null on empty / null-ish input', () => {
    expect(extractZip('')).toBeNull();
    expect(extractZip(null)).toBeNull();
    expect(extractZip(undefined)).toBeNull();
  });

  it('does not match phone numbers or other 5-digit sequences', () => {
    // No comma + state pattern → not a zip context. We're conservative:
    // only match 5-digit sequences at end-of-string or end-of-line.
    expect(extractZip('Phone 12345 some other address')).toBeNull();
  });

  it('matches the LAST 5-digit zip when multiple are present', () => {
    // Some addresses include both a unit number and zip; we want the zip.
    expect(extractZip('Apt 12345, Owensboro, KY 42303')).toBe('42303');
  });
});

const filing = (zip: string | null, daysAgo: number): FilingForPriorities => ({
  defendantAddress:
    zip === null ? '123 Main St, Owensboro, KY' : `123 Main St, Owensboro, KY ${zip}`,
  filedAt: new Date(Date.now() - daysAgo * 86_400_000),
});

describe('computeOutreachPriorities', () => {
  it('ranks zips by filing count descending', () => {
    const filings: FilingForPriorities[] = [
      ...Array(8).fill(filing('42301', 1)),
      ...Array(12).fill(filing('42303', 2)),
    ];
    const r = computeOutreachPriorities(filings, { minCellSize: 5 });
    expect(r.priorities[0].zip).toBe('42303');
    expect(r.priorities[0].count).toBe(12);
    expect(r.priorities[1].zip).toBe('42301');
    expect(r.priorities[1].count).toBe(8);
  });

  it('suppresses zips below the cell-size threshold', () => {
    const filings: FilingForPriorities[] = [
      ...Array(2).fill(filing('42301', 1)), // below threshold
      ...Array(7).fill(filing('42303', 2)),
    ];
    const r = computeOutreachPriorities(filings, { minCellSize: 5 });
    // 42301 dropped; 42303 reported.
    expect(r.priorities.map((p) => p.zip)).toEqual(['42303']);
    expect(r.suppressedRegions).toBe(1);
    expect(r.suppressedCount).toBe(2);
  });

  it('groups null-zip filings into "unknown" and suppresses if below threshold', () => {
    const filings: FilingForPriorities[] = [
      ...Array(10).fill(filing('42301', 1)),
      ...Array(3).fill(filing(null, 5)),
    ];
    const r = computeOutreachPriorities(filings, { minCellSize: 5 });
    expect(r.priorities.map((p) => p.zip)).toEqual(['42301']);
    expect(r.unknownZipCount).toBe(3);
  });

  it('uses default min cell size = 5', () => {
    expect(DEFAULT_OUTREACH_MIN_CELL_SIZE).toBe(5);
    const filings: FilingForPriorities[] = Array(4).fill(filing('42301', 1));
    const r = computeOutreachPriorities(filings);
    expect(r.priorities).toEqual([]);
    expect(r.suppressedRegions).toBe(1);
  });

  it('returns empty priorities + zero counts on empty input', () => {
    const r = computeOutreachPriorities([]);
    expect(r.priorities).toEqual([]);
    expect(r.totalFilings).toBe(0);
  });

  it('exposes total filings (across all zips, including suppressed)', () => {
    const filings: FilingForPriorities[] = [
      ...Array(7).fill(filing('42301', 1)),
      ...Array(2).fill(filing('42303', 2)),
    ];
    const r = computeOutreachPriorities(filings, { minCellSize: 5 });
    expect(r.totalFilings).toBe(9);
  });

  it('breaks ties on count by zip ascending (deterministic)', () => {
    const filings: FilingForPriorities[] = [
      ...Array(7).fill(filing('42303', 1)),
      ...Array(7).fill(filing('42301', 2)),
    ];
    const r = computeOutreachPriorities(filings, { minCellSize: 5 });
    // Same count → smaller zip wins the tie-break.
    expect(r.priorities.map((p) => p.zip)).toEqual(['42301', '42303']);
  });
});
