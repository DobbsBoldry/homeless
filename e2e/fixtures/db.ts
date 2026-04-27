import postgres from 'postgres';

export type Sql = ReturnType<typeof postgres>;

export function dbClient(): Sql {
  const url = process.env.DATABASE_URL;
  if (!url) throw new Error('DATABASE_URL not set; run pnpm e2e:setup first');
  return postgres(url, { max: 1, idle_timeout: 5, prepare: false });
}
