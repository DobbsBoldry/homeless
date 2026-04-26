// Production migration runner. Used by the `start` script on Railway
// so every deploy applies any pending migrations before the app accepts
// traffic. Stays in plain .mjs so it runs without tsx / drizzle-kit
// (both devDeps).
//
// Idempotent — drizzle-orm's migrator records applied migrations in
// `__drizzle_migrations` and skips them on subsequent runs.

import { drizzle } from 'drizzle-orm/postgres-js';
import { migrate } from 'drizzle-orm/postgres-js/migrator';
import postgres from 'postgres';

const url = process.env.DATABASE_URL;
if (!url) {
  console.error('[migrate-prod] DATABASE_URL is not set');
  process.exit(1);
}

const sql = postgres(url, { max: 1, prepare: false });
const db = drizzle(sql);

try {
  console.log('[migrate-prod] applying migrations…');
  await migrate(db, { migrationsFolder: './drizzle/migrations' });
  console.log('[migrate-prod] done');
} catch (err) {
  console.error('[migrate-prod] failed:', err);
  process.exit(1);
} finally {
  await sql.end({ timeout: 5 });
}
