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
 * - Inserts via onConflictDoNothing on the unique (case_number, source) idx
 * - Skips parse errors with a warning (doesn't fail the whole load)
 *
 * Safe to re-run; existing rows are not touched.
 */
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { parseArgs } from 'node:util';
import { config } from 'dotenv';
import { db } from '@/db/client';
import { evictionFilings } from '@/db/schema/eviction-filings';
import { parseEvictionFiling } from '@/lib/eviction/parser';

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

  let inserted = 0;
  let skipped = 0;
  let errored = 0;

  for (const record of raw.filings) {
    const result = parseEvictionFiling(record, 'synthetic');
    if (!result.ok) {
      console.warn('[load] parse error', { errors: result.errors });
      errored++;
      continue;
    }
    const [row] = await db
      .insert(evictionFilings)
      .values(result.filing)
      .onConflictDoNothing({
        target: [evictionFilings.caseNumber, evictionFilings.source],
      })
      .returning({ id: evictionFilings.id });
    if (row) inserted++;
    else skipped++;
  }

  console.log(`[load] inserted=${inserted} skipped=${skipped} errored=${errored}`);
  process.exit(0);
}

main().catch((err) => {
  console.error('[load] failed', err);
  process.exit(1);
});
