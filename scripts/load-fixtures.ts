#!/usr/bin/env tsx
/**
 * Idempotent loader for the EVDT-024 synthetic eviction filings fixture.
 *
 * Usage:
 *   pnpm tsx scripts/load-fixtures.ts
 *   pnpm tsx scripts/load-fixtures.ts --file fixtures/eviction-filings.json
 *
 * - Reads the JSON file produced by gen-synthetic-filings.ts
 * - Parses each row through src/lib/eviction/parser.ts
 * - Upserts via src/lib/eviction/upsert.ts (handles cross-source rank,
 *   no-op on unchanged, update on real change)
 *
 * Safe to re-run.
 */
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { parseArgs } from 'node:util';
import { config } from 'dotenv';
import { parseEvictionFiling } from '@/lib/eviction/parser';
import { upsertFiling } from '@/lib/eviction/upsert';

config({ path: ['.env.local', '.env'], override: true });

const { values } = parseArgs({
  options: {
    file: { type: 'string', default: 'fixtures/eviction-filings.json' },
  },
});

async function main() {
  const filePath = resolve(process.cwd(), values.file);
  console.log(`[load] reading ${filePath}`);

  const raw = JSON.parse(readFileSync(filePath, 'utf8')) as { filings: unknown[] };
  if (!Array.isArray(raw.filings)) {
    throw new Error('fixture file missing top-level "filings" array');
  }

  const counts = { inserted: 0, updated: 0, unchanged: 0, superseded: 0, parse_errors: 0 };

  for (const record of raw.filings) {
    const result = parseEvictionFiling(record, 'synthetic');
    if (!result.ok) {
      console.warn('[load] parse error', { errors: result.errors });
      counts.parse_errors++;
      continue;
    }
    const { action } = await upsertFiling(result.filing);
    counts[action]++;
  }

  console.log(`[load] ${JSON.stringify(counts)}`);
  process.exit(0);
}

main().catch((err) => {
  console.error('[load] failed', err);
  process.exit(1);
});
