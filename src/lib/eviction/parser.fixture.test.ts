import { readFileSync } from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import { parseEvictionFiling } from './parser';

/**
 * Integration check: the parser must consume the EVDT-024 baseline fixture
 * cleanly. Tracks the AC "Parses the full fixture file with <2 ParseErrors"
 * — a regression here means either the generator drifted from the parser's
 * expected shape, or the fixture is stale.
 */
describe('parseEvictionFiling — fixture sweep', () => {
  it('parses the EVDT-024 baseline fixture (fixtures/eviction-filings.json)', () => {
    const raw = JSON.parse(
      readFileSync(path.join(process.cwd(), 'fixtures/eviction-filings.json'), 'utf8'),
    ) as { filings: unknown[] };

    const results = raw.filings.map((f) => parseEvictionFiling(f, 'synthetic'));
    const errors = results.filter((r) => !r.ok);
    if (errors.length > 0) {
      console.error('[fixture] parse errors:', JSON.stringify(errors.slice(0, 3), null, 2));
    }
    expect(raw.filings.length).toBeGreaterThan(0);
    expect(errors.length).toBeLessThan(2);
  });
});
