import { config } from 'dotenv';
import { drizzle } from 'drizzle-orm/postgres-js';

// Load .env.local for non-Next contexts (drizzle-kit, scripts).
// Next.js itself auto-loads it for the app runtime.
if (!process.env.DATABASE_URL) {
  config({ path: ['.env.local', '.env'] });
}

import postgres from 'postgres';
import * as schema from './schema';

const connectionString = process.env.DATABASE_URL;
if (!connectionString) {
  throw new Error('DATABASE_URL is not set');
}

// Singleton across hot reloads in dev.
const globalForPg = globalThis as unknown as { sql?: ReturnType<typeof postgres> };

const sql = globalForPg.sql ?? postgres(connectionString, { prepare: false });
if (process.env.NODE_ENV !== 'production') {
  globalForPg.sql = sql;
}

export const db = drizzle(sql, { schema });
export { schema };
