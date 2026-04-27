#!/usr/bin/env tsx
/**
 * Apply Drizzle migrations to the e2e DB, one transaction per migration.
 * Drizzle's built-in migrate() wraps the entire run in a single transaction,
 * which trips Postgres' "new enum values must be committed before use" rule
 * when a migration both adds an enum value and uses it.
 *
 * This runner statements out each migration in its own transaction.
 * Idempotent: tracks applied migrations in __drizzle_e2e_migrations.
 */
import { readdir, readFile } from 'node:fs/promises';
import { join } from 'node:path';
import postgres from 'postgres';

const MIGRATIONS_DIR = join(process.cwd(), 'drizzle/migrations');

async function main() {
  const url = process.env.DATABASE_URL;
  if (!url) throw new Error('DATABASE_URL not set');

  const sql = postgres(url, { max: 1, prepare: false });
  try {
    await sql`
      create table if not exists __drizzle_e2e_migrations (
        name text primary key,
        applied_at timestamptz not null default now()
      )
    `;
    const applied = await sql`select name from __drizzle_e2e_migrations`;
    const appliedSet = new Set(applied.map((r) => r.name as string));

    const files = (await readdir(MIGRATIONS_DIR)).filter((f) => f.endsWith('.sql')).sort();

    let count = 0;
    for (const file of files) {
      if (appliedSet.has(file)) continue;
      const path = join(MIGRATIONS_DIR, file);
      const raw = await readFile(path, 'utf8');
      // Drizzle splits statements with `--> statement-breakpoint`
      const statements = raw
        .split('--> statement-breakpoint')
        .map((s) => s.trim())
        .filter((s) => s.length > 0);

      for (const stmt of statements) {
        await sql.unsafe(stmt);
      }
      await sql`insert into __drizzle_e2e_migrations (name) values (${file})`;
      console.log(`[e2e-migrate] applied ${file}`);
      count++;
    }
    console.log(`[e2e-migrate] done — applied ${count} new migration(s)`);
  } finally {
    await sql.end({ timeout: 5 });
  }
}

main().catch((err) => {
  console.error('[e2e-migrate] failed:', err);
  process.exit(1);
});
