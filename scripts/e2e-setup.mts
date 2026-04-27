#!/usr/bin/env tsx
/**
 * Boots the e2e Postgres container, applies migrations, runs the demo seed,
 * provisions Clerk test users, and rewrites the seeded users' clerk_user_id
 * fields to point at the real Clerk users.
 *
 * Idempotent: safe to run repeatedly.
 *
 * Strategy for Clerk users: the seed creates one user per role with a fake
 * clerk_user_id like 'seed_attorney'. We create real Clerk test-instance
 * users with stable e2e emails, then UPDATE the seed-created rows to use
 * those real Clerk IDs. Preserves org memberships (incl. KLA Owensboro
 * for the attorney) intact.
 */
import { execSync } from 'node:child_process';
import { existsSync } from 'node:fs';
import { createClerkClient } from '@clerk/backend';
import { config as loadEnv } from 'dotenv';
import postgres from 'postgres';

const ENV_FILE = '.env.e2e';
const COMPOSE_FILE = 'e2e/docker-compose.yml';

type PersonaKey = 'attorney' | 'caseworker' | 'coordinator' | 'shelter' | 'admin';
type SeedRole = 'attorney' | 'caseworker' | 'ed_coordinator' | 'shelter_staff' | 'admin';

interface PersonaSpec {
  key: PersonaKey;
  email: string;
  seedRole: SeedRole; // role assigned by `pnpm db:seed`
  password: string;
}

const PERSONAS: PersonaSpec[] = [
  { key: 'attorney', email: 'attorney+e2e@example.com', seedRole: 'attorney', password: 'E2eTest!2026Aa' },
  {
    key: 'caseworker',
    email: 'caseworker+e2e@example.com',
    seedRole: 'caseworker',
    password: 'E2eTest!2026Cw',
  },
  {
    key: 'coordinator',
    email: 'coordinator+e2e@example.com',
    seedRole: 'ed_coordinator',
    password: 'E2eTest!2026Co',
  },
  {
    key: 'shelter',
    email: 'shelter+e2e@example.com',
    seedRole: 'shelter_staff',
    password: 'E2eTest!2026Sh',
  },
  { key: 'admin', email: 'admin+e2e@example.com', seedRole: 'admin', password: 'E2eTest!2026Ad' },
];

function fail(msg: string): never {
  console.error(`\n[e2e-setup] FAIL: ${msg}\n`);
  process.exit(1);
}

function sh(cmd: string, env: NodeJS.ProcessEnv = {}): string {
  return execSync(cmd, { stdio: 'pipe', encoding: 'utf8', env: { ...process.env, ...env } });
}

async function main() {
  if (!existsSync(ENV_FILE)) {
    fail(`${ENV_FILE} missing — copy .env.e2e.example and fill in real values`);
  }
  loadEnv({ path: ENV_FILE, override: true });

  const required = [
    'DATABASE_URL',
    'NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY',
    'CLERK_SECRET_KEY',
    'ANTHROPIC_API_KEY',
  ];
  const missing = required.filter((k) => !process.env[k]);
  if (missing.length) fail(`missing keys in ${ENV_FILE}: ${missing.join(', ')}`);

  if (!process.env.DATABASE_URL!.includes(':5434/')) {
    fail(`DATABASE_URL must point at the e2e container on :5434, got ${process.env.DATABASE_URL}`);
  }
  if (!process.env.CLERK_SECRET_KEY!.startsWith('sk_test_')) {
    fail('CLERK_SECRET_KEY must be a test-instance key (sk_test_...) — refusing to touch prod');
  }

  console.log('[e2e-setup] starting postgres container...');
  sh(`docker compose -f ${COMPOSE_FILE} up -d`);

  // Wait for healthy
  for (let i = 0; i < 30; i++) {
    try {
      sh(`docker compose -f ${COMPOSE_FILE} exec -T postgres pg_isready -U postgres -d homeless_e2e`);
      break;
    } catch {
      await new Promise((r) => setTimeout(r, 1000));
    }
    if (i === 29) fail('postgres did not become healthy within 30s');
  }

  console.log('[e2e-setup] applying migrations...');
  sh('pnpm tsx scripts/e2e-migrate.mts', { DATABASE_URL: process.env.DATABASE_URL });

  console.log('[e2e-setup] seeding demo data...');
  sh('pnpm db:seed', { DATABASE_URL: process.env.DATABASE_URL });

  console.log('[e2e-setup] provisioning Clerk test users + linking to seeded rows...');
  await provisionClerkUsersAndLink();

  console.log('[e2e-setup] done.');
}

async function provisionClerkUsersAndLink() {
  const clerk = createClerkClient({ secretKey: process.env.CLERK_SECRET_KEY! });
  const sql = postgres(process.env.DATABASE_URL!, { max: 1, prepare: false });
  try {
    for (const p of PERSONAS) {
      // Create or fetch Clerk user.
      const existing = await clerk.users.getUserList({ emailAddress: [p.email] });
      let clerkId: string;
      if (existing.data.length > 0) {
        clerkId = existing.data[0]!.id;
        console.log(`[e2e-setup]   = clerk user ${p.email} (${clerkId})`);
      } else {
        const created = await clerk.users.createUser({
          emailAddress: [p.email],
          password: p.password,
          publicMetadata: { e2e: true, role: p.seedRole },
          skipPasswordChecks: true,
        });
        clerkId = created.id;
        console.log(`[e2e-setup]   + clerk user ${p.email} (${clerkId})`);
      }

      // Update the seeded user row (clerk_user_id = 'seed_<role>') to use the real Clerk ID.
      // If the e2e Clerk user is already linked, this updates the email too. The seed user has
      // a fake email that we rewrite to the e2e email so future signups don't conflict.
      const seededClerkId = `seed_${p.seedRole}`;
      const result = await sql`
        update users
        set clerk_user_id = ${clerkId}, email = ${p.email}, updated_at = now()
        where clerk_user_id = ${seededClerkId} or clerk_user_id = ${clerkId}
        returning id, email, role
      `;
      if (result.length === 0) {
        console.warn(
          `[e2e-setup]   ! no user row matched for ${p.seedRole} — seed may have changed`,
        );
      }
    }
  } finally {
    await sql.end({ timeout: 5 });
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
