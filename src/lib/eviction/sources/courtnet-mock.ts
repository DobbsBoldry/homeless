import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import type { DocketSource, RawFiling } from './types';

/**
 * Mock source: reads `fixtures/eviction-filings.json` and returns it as
 * "today's docket". Each call rotates filed_at timestamps to today (within
 * a 0-12h jitter) so the dashboard always shows a recent docket regardless
 * of when the fixture was generated.
 *
 * Tagged as `synthetic` source so upsertFiling() correctly defers to any
 * real `courtnet`-source row that lands later for the same case_number.
 */
class CourtnetMockSource implements DocketSource {
  readonly source = 'synthetic' as const;
  readonly name = 'courtnet-mock (fixtures/eviction-filings.json)';

  constructor(private readonly fixturePath: string) {}

  async fetchTodaysDocket(): Promise<RawFiling[]> {
    const raw = JSON.parse(await readFile(this.fixturePath, 'utf8')) as { filings: RawFiling[] };
    if (!Array.isArray(raw.filings)) return [];

    // Rotate filed_at to today so the "today's docket" semantics hold.
    // Spread across a 12-hour business window to look plausibly real.
    const today = new Date();
    today.setHours(8, 0, 0, 0); // start at 08:00 local
    return raw.filings.map((f, i) => {
      const offsetMinutes = (i * 13) % (12 * 60); // 0..720
      const t = new Date(today.getTime() + offsetMinutes * 60_000);
      return { ...f, filed_at: t.toISOString() };
    });
  }
}

export const courtnetMock = new CourtnetMockSource(
  resolve(process.cwd(), 'fixtures/eviction-filings.json'),
);
