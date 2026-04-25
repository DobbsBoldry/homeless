import { config } from 'dotenv';
import { defineConfig } from 'drizzle-kit';

config({ path: ['.env.local', '.env'] });

if (!process.env.DATABASE_URL) {
  throw new Error('DATABASE_URL is not set');
}

export default defineConfig({
  schema: './src/db/schema/*',
  out: './drizzle/migrations',
  dialect: 'postgresql',
  dbCredentials: {
    url: process.env.DATABASE_URL,
  },
  verbose: true,
  strict: true,
});
