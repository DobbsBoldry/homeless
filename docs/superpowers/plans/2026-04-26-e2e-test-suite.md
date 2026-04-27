# e2e Test Suite Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Stand up Playwright e2e suite (5 persona journeys + 6 smoke tests) covering shipped Sprint 1-6 functionality, with Docker-isolated DB, mocked outbound (Anthropic / Resend / Twilio) via a single instrumentation hook, and a `gh`-based bug-filing workflow for failures.

**Architecture:** Tests live in `e2e/`. A new `scripts/e2e-setup.mts` brings up an isolated `postgres:16-alpine` container, pushes the Drizzle schema, runs the existing demo seed, and provisions Clerk test users. Playwright spawns `next dev` against the e2e DB. All outbound HTTP (Anthropic, Twilio, Resend) is intercepted in `instrumentation.ts` when `E2E_MOCK_OUTBOUND=1` — Anthropic responses are cached to disk, Twilio/Resend payloads land in a new `outbound_messages_test` table. Production paths are unchanged.

**Tech Stack:** Playwright (`@playwright/test`), `postgres:16-alpine` via Docker Compose, Drizzle (existing), Clerk testingTokens, Node `fetch` patching in `instrumentation.ts`.

**Important note for the implementer:** Unlike a typical TDD plan, the e2e tests in this plan target *already-shipped features*. The expected outcome on the first run is **PASS**. If a test fails, the failure is **almost certainly a real product bug**, not a test bug — do NOT modify the test to make it pass. Instead, capture the failure (Playwright's trace), open a `bug`/`e2e`-labeled GitHub issue (Task 19 builds the helper for this), and continue with remaining tasks. Only fix the test if you can prove from the code that the test's assertion is wrong.

---

## File structure (locked in before tasks)

```
e2e/
  docker-compose.yml          # one postgres:16-alpine service on :5433
  playwright.config.ts        # webServer launches next dev w/ E2E env
  fixtures/
    auth.ts                   # storageState provisioning per role
    db.ts                     # raw postgres client for seed-bypass setup
    test-base.ts              # extended Playwright `test` w/ persona param
  journeys/
    kla-attorney.spec.ts      # J1
    oh-coordinator.spec.ts    # J2
    caseworker.spec.ts        # J3
    dispatcher-sms.spec.ts    # J4
    coalition-admin.spec.ts   # J5
  smoke/
    audit-log.spec.ts         # S3
    twilio-signature.spec.ts  # S5
    role-access.spec.ts       # S4
    consent-gate.spec.ts      # S1
    dv-blind.spec.ts          # S2
    bed-hold-expiration.spec.ts  # S6
  README.md
.env.e2e.example
.gitignore                    # +e2e/.cache, +e2e/.traces, +.env.e2e
scripts/
  e2e-setup.mts               # docker up, schema push, seed, clerk users
  e2e-report.mts              # gh-issue drafter from playwright-report
src/
  db/schema/outbound-messages-test.ts  # new Drizzle table
  instrumentation.ts          # extended w/ E2E_MOCK_OUTBOUND fetch patch
package.json                  # +e2e, +e2e:setup, +e2e:report, deps
```

---

## Task 1: Bootstrap dependencies and scripts

**Files:**
- Modify: `package.json`
- Modify: `.gitignore`
- Create: `.env.e2e.example`

- [ ] **Step 1: Install Playwright and Postgres client**

```bash
pnpm add -D @playwright/test postgres
pnpm exec playwright install chromium
```

- [ ] **Step 2: Add e2e scripts to package.json**

Add to the `scripts` object (preserving existing entries):

```json
"e2e": "pnpm e2e:setup && playwright test --config=e2e/playwright.config.ts",
"e2e:setup": "tsx scripts/e2e-setup.mts",
"e2e:teardown": "docker compose -f e2e/docker-compose.yml down -v",
"e2e:report": "tsx scripts/e2e-report.mts",
"e2e:ui": "pnpm e2e:setup && playwright test --config=e2e/playwright.config.ts --ui"
```

- [ ] **Step 3: Update .gitignore**

Append to `.gitignore`:

```
# e2e suite
.env.e2e
e2e/.traces/
e2e/.playwright/
e2e/test-results/
playwright-report/
# AI cache: gitignored locally, committed in CI via separate workflow
e2e/.cache/
```

- [ ] **Step 4: Create .env.e2e.example**

```
# Database — points at the docker-compose service in e2e/docker-compose.yml
DATABASE_URL=postgres://postgres:postgres@localhost:5433/homeless_e2e

# Clerk — use a dedicated Clerk *test* instance, NOT your production keys
NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY=pk_test_...
CLERK_SECRET_KEY=sk_test_...

# Anthropic — required to populate the AI cache on first run
ANTHROPIC_API_KEY=sk-ant-...

# Outbound mocking flag — leave at 1 for e2e
E2E_MOCK_OUTBOUND=1

# Twilio (only needs valid auth token for signature verification in tests)
TWILIO_AUTH_TOKEN=test_token_for_signature_verification
TWILIO_FROM_NUMBER=+15555550100

# Resend — any string; outbound is intercepted, this just needs to be set
RESEND_API_KEY=re_test_unused

# Optional: Sentry DSN (leave blank to disable in tests)
SENTRY_DSN=
```

- [ ] **Step 5: Verify install**

Run: `pnpm exec playwright --version`
Expected: prints a version like `Version 1.x.x`.

- [ ] **Step 6: Commit**

```bash
git add package.json pnpm-lock.yaml .gitignore .env.e2e.example
git commit -m "chore(e2e): add playwright + scripts scaffolding"
```

---

## Task 2: Docker Compose for e2e Postgres

**Files:**
- Create: `e2e/docker-compose.yml`

- [ ] **Step 1: Write the compose file**

```yaml
services:
  postgres:
    image: postgres:16-alpine
    container_name: homeless-e2e-postgres
    environment:
      POSTGRES_USER: postgres
      POSTGRES_PASSWORD: postgres
      POSTGRES_DB: homeless_e2e
    ports:
      - "5433:5432"
    healthcheck:
      test: ["CMD-SHELL", "pg_isready -U postgres -d homeless_e2e"]
      interval: 2s
      timeout: 2s
      retries: 30
    tmpfs:
      - /var/lib/postgresql/data  # ephemeral; volumes destroyed on `down -v`
```

`tmpfs` is intentional: the e2e DB lives in RAM, so `docker compose down -v` instantly wipes it and the next run starts fully clean. No persistent volume to manage.

- [ ] **Step 2: Verify it starts**

Run: `docker compose -f e2e/docker-compose.yml up -d && docker compose -f e2e/docker-compose.yml ps`
Expected: `homeless-e2e-postgres` shown as `healthy` within ~5 seconds.

Then: `docker compose -f e2e/docker-compose.yml down -v`
Expected: container removed cleanly.

- [ ] **Step 3: Commit**

```bash
git add e2e/docker-compose.yml
git commit -m "chore(e2e): docker-compose postgres on :5433"
```

---

## Task 3: Outbound messages test table

**Files:**
- Create: `src/db/schema/outbound-messages-test.ts`
- Modify: `src/db/schema/index.ts` (export the new table)

- [ ] **Step 1: Write the schema file**

```ts
import { pgTable, serial, text, timestamp } from 'drizzle-orm/pg-core';

export const outboundMessagesTest = pgTable('outbound_messages_test', {
  id: serial('id').primaryKey(),
  kind: text('kind').notNull(),     // 'twilio.sms' | 'resend.email'
  to: text('to').notNull(),
  body: text('body').notNull(),
  metaJson: text('meta_json').notNull().default('{}'),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
});

export type OutboundMessageTest = typeof outboundMessagesTest.$inferSelect;
```

- [ ] **Step 2: Re-export from schema index**

Open `src/db/schema/index.ts` and add the export alongside the existing ones:

```ts
export * from './outbound-messages-test';
```

(If the index file uses an alternate pattern — e.g., named imports / re-exports of selected tables — match it. Inspect the file first.)

- [ ] **Step 3: Generate migration locally**

Run: `pnpm db:generate`
Expected: a new `drizzle/<NNNN>_*.sql` file containing `CREATE TABLE "outbound_messages_test"`.

- [ ] **Step 4: Verify migration is sane**

Open the generated SQL file. Confirm it contains exactly the create-table statement, no destructive changes to existing tables.

- [ ] **Step 5: Commit**

```bash
git add src/db/schema/outbound-messages-test.ts src/db/schema/index.ts drizzle/
git commit -m "feat(e2e): outbound_messages_test table for outbound interception"
```

---

## Task 4: Instrumentation fetch interceptor

**Files:**
- Modify: `src/instrumentation.ts` (existing — extend, don't replace)
- Create: `src/lib/e2e/intercept.ts`

This is the heart of the harness. When `E2E_MOCK_OUTBOUND=1`, every server-side `fetch` to Anthropic / Twilio / Resend is rerouted: Anthropic to a disk cache, Twilio/Resend to the new DB table.

- [ ] **Step 1: Read the existing instrumentation file**

Read `src/instrumentation.ts` fully. Note the existing `register()` shape and any Sentry init order.

- [ ] **Step 2: Write the intercept module**

Create `src/lib/e2e/intercept.ts`:

```ts
import { createHash } from 'node:crypto';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import postgres from 'postgres';

const CACHE_DIR = join(process.cwd(), 'e2e/.cache/ai');
const ANTHROPIC_HOST = 'api.anthropic.com';
const TWILIO_HOST = 'api.twilio.com';
const RESEND_HOST = 'api.resend.com';
const E2E_MODEL = 'claude-haiku-4-5';

let installed = false;

export function installE2EInterceptor(): void {
  if (installed) return;
  if (process.env.E2E_MOCK_OUTBOUND !== '1') return;
  installed = true;

  const realFetch = globalThis.fetch.bind(globalThis);

  globalThis.fetch = (async (input: RequestInfo | URL, init?: RequestInit) => {
    const url = typeof input === 'string' ? input : input instanceof URL ? input.toString() : input.url;

    if (url.includes(ANTHROPIC_HOST)) {
      return interceptAnthropic(url, init, realFetch);
    }
    if (url.includes(TWILIO_HOST)) {
      return interceptTwilio(url, init);
    }
    if (url.includes(RESEND_HOST)) {
      return interceptResend(url, init);
    }
    return realFetch(input, init);
  }) as typeof fetch;
}

async function interceptAnthropic(
  url: string,
  init: RequestInit | undefined,
  realFetch: typeof fetch,
): Promise<Response> {
  const bodyText = typeof init?.body === 'string' ? init.body : '';
  let parsed: Record<string, unknown> = {};
  try {
    parsed = JSON.parse(bodyText);
  } catch {
    return realFetch(url, init);
  }

  // Force cheap model regardless of what production code requested.
  parsed.model = E2E_MODEL;
  const rewrittenBody = JSON.stringify(parsed);
  const hash = createHash('sha256').update(rewrittenBody).digest('hex');
  const cachePath = join(CACHE_DIR, `${hash}.json`);

  try {
    const cached = await readFile(cachePath, 'utf8');
    return new Response(cached, {
      status: 200,
      headers: { 'content-type': 'application/json' },
    });
  } catch {
    // cache miss — call real API with rewritten body, persist response
    const realResp = await realFetch(url, {
      ...init,
      body: rewrittenBody,
    });
    const respText = await realResp.text();
    await mkdir(dirname(cachePath), { recursive: true });
    await writeFile(cachePath, respText, 'utf8');
    return new Response(respText, {
      status: realResp.status,
      headers: realResp.headers,
    });
  }
}

async function interceptTwilio(url: string, init: RequestInit | undefined): Promise<Response> {
  // Twilio outbound message API: POST .../Messages.json with form-encoded body
  if (!url.includes('/Messages')) {
    return new Response('{}', { status: 200 });
  }
  const formBody = typeof init?.body === 'string' ? init.body : '';
  const params = new URLSearchParams(formBody);
  await recordOutbound('twilio.sms', params.get('To') ?? '', params.get('Body') ?? '', {
    from: params.get('From') ?? '',
  });
  // Mimic the relevant fields of a Twilio success response
  return new Response(
    JSON.stringify({
      sid: `SM${'e2e'.padEnd(32, '0')}`,
      status: 'queued',
      to: params.get('To') ?? '',
      body: params.get('Body') ?? '',
    }),
    { status: 201, headers: { 'content-type': 'application/json' } },
  );
}

async function interceptResend(url: string, init: RequestInit | undefined): Promise<Response> {
  if (!url.includes('/emails')) {
    return new Response('{}', { status: 200 });
  }
  const bodyText = typeof init?.body === 'string' ? init.body : '';
  let parsed: { to?: string | string[]; subject?: string; html?: string; text?: string } = {};
  try {
    parsed = JSON.parse(bodyText);
  } catch {
    /* fall through with empty parsed */
  }
  const to = Array.isArray(parsed.to) ? parsed.to.join(',') : parsed.to ?? '';
  const body = parsed.html ?? parsed.text ?? '';
  await recordOutbound('resend.email', to, body, { subject: parsed.subject ?? '' });
  return new Response(JSON.stringify({ id: 'e2e-resend-id' }), {
    status: 200,
    headers: { 'content-type': 'application/json' },
  });
}

async function recordOutbound(
  kind: 'twilio.sms' | 'resend.email',
  to: string,
  body: string,
  meta: Record<string, string>,
): Promise<void> {
  const url = process.env.DATABASE_URL;
  if (!url) return;
  const sql = postgres(url, { max: 1, idle_timeout: 1 });
  try {
    await sql`
      insert into outbound_messages_test (kind, "to", body, meta_json)
      values (${kind}, ${to}, ${body}, ${JSON.stringify(meta)})
    `;
  } finally {
    await sql.end({ timeout: 1 });
  }
}
```

- [ ] **Step 3: Hook the interceptor into instrumentation.ts**

Open `src/instrumentation.ts`. Add to the top of the existing `register()` body (before any Sentry init so the patch is in place when the first request is served):

```ts
import { installE2EInterceptor } from '@/lib/e2e/intercept';

export async function register() {
  if (process.env.NEXT_RUNTIME === 'nodejs') {
    installE2EInterceptor();
  }
  // ...existing register body unchanged...
}
```

If the existing file already has `register()`, integrate the call rather than duplicating. The function is a no-op when `E2E_MOCK_OUTBOUND` is unset.

- [ ] **Step 4: Smoke-test the interceptor manually**

```bash
docker compose -f e2e/docker-compose.yml up -d
DATABASE_URL='postgres://postgres:postgres@localhost:5433/homeless_e2e' pnpm db:push
DATABASE_URL='postgres://postgres:postgres@localhost:5433/homeless_e2e' \
E2E_MOCK_OUTBOUND=1 \
pnpm tsx -e "
  const { installE2EInterceptor } = require('./src/lib/e2e/intercept');
  installE2EInterceptor();
  (async () => {
    const r = await fetch('https://api.twilio.com/2010-04-01/Accounts/x/Messages.json', {
      method: 'POST',
      body: new URLSearchParams({ To: '+15551234567', From: '+15555550100', Body: 'hello' }).toString(),
      headers: { 'content-type': 'application/x-www-form-urlencoded' },
    });
    console.log('status:', r.status);
    console.log('body:', await r.text());
  })();
"
```

Expected: status `201`, body contains `"status":"queued"`.

Then:

```bash
docker compose -f e2e/docker-compose.yml exec postgres psql -U postgres -d homeless_e2e \
  -c 'select kind, "to", body from outbound_messages_test;'
```

Expected: one row with `twilio.sms`, `+15551234567`, `hello`.

Then teardown: `docker compose -f e2e/docker-compose.yml down -v`.

- [ ] **Step 5: Commit**

```bash
git add src/lib/e2e/intercept.ts src/instrumentation.ts
git commit -m "feat(e2e): server-side fetch interceptor for anthropic/twilio/resend"
```

---

## Task 5: e2e setup script

**Files:**
- Create: `scripts/e2e-setup.mts`

This script is what `pnpm e2e:setup` runs. It is idempotent — running twice in a row is safe.

- [ ] **Step 1: Write the script**

```ts
#!/usr/bin/env tsx
/**
 * Boots the e2e Postgres container, pushes the Drizzle schema,
 * runs the demo seed, and provisions Clerk test users.
 *
 * Idempotent: safe to run repeatedly.
 */
import { execSync } from 'node:child_process';
import { existsSync } from 'node:fs';
import { config as loadEnv } from 'dotenv';
import postgres from 'postgres';
import { createClerkClient } from '@clerk/backend';

const ENV_FILE = '.env.e2e';
const COMPOSE = 'docker compose -f e2e/docker-compose.yml';

function fail(msg: string): never {
  console.error(`\n[e2e-setup] FAIL: ${msg}\n`);
  process.exit(1);
}

function sh(cmd: string, opts: { env?: NodeJS.ProcessEnv } = {}): string {
  return execSync(cmd, { stdio: 'pipe', encoding: 'utf8', env: { ...process.env, ...opts.env } });
}

async function main() {
  if (!existsSync(ENV_FILE)) fail(`${ENV_FILE} missing — copy .env.e2e.example and fill in keys`);
  loadEnv({ path: ENV_FILE });

  const required = [
    'DATABASE_URL',
    'NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY',
    'CLERK_SECRET_KEY',
    'ANTHROPIC_API_KEY',
  ];
  const missing = required.filter((k) => !process.env[k]);
  if (missing.length) fail(`missing env keys in ${ENV_FILE}: ${missing.join(', ')}`);

  if (!process.env.DATABASE_URL!.includes(':5433/')) {
    fail(`DATABASE_URL must point at the e2e container on :5433, got ${process.env.DATABASE_URL}`);
  }

  console.log('[e2e-setup] starting postgres container...');
  sh(`${COMPOSE} up -d`);

  // Wait for healthy
  for (let i = 0; i < 30; i++) {
    try {
      sh(`${COMPOSE} exec -T postgres pg_isready -U postgres -d homeless_e2e`);
      break;
    } catch {
      await new Promise((r) => setTimeout(r, 1000));
    }
    if (i === 29) fail('postgres did not become healthy within 30s');
  }

  console.log('[e2e-setup] pushing drizzle schema...');
  sh('pnpm db:push', { env: { DATABASE_URL: process.env.DATABASE_URL } });

  console.log('[e2e-setup] seeding demo data...');
  sh('pnpm db:seed', { env: { DATABASE_URL: process.env.DATABASE_URL } });

  console.log('[e2e-setup] provisioning Clerk test users...');
  await provisionClerkUsers();

  console.log('[e2e-setup] done.');
}

async function provisionClerkUsers() {
  const clerk = createClerkClient({ secretKey: process.env.CLERK_SECRET_KEY! });

  const personas = [
    { email: 'attorney@e2e.test', role: 'attorney' },
    { email: 'coordinator@e2e.test', role: 'care_coordinator' },
    { email: 'caseworker@e2e.test', role: 'caseworker' },
    { email: 'dispatcher@e2e.test', role: 'dispatcher' },
    { email: 'admin@e2e.test', role: 'superadmin' },
  ];

  // Map Clerk user -> DB user, since the app uses a local users table linked by clerk_id.
  const sql = postgres(process.env.DATABASE_URL!, { max: 1 });
  try {
    for (const p of personas) {
      const existing = await clerk.users.getUserList({ emailAddress: [p.email] });
      let userId: string;
      if (existing.data.length > 0) {
        userId = existing.data[0]!.id;
      } else {
        const created = await clerk.users.createUser({
          emailAddress: [p.email],
          password: 'E2eTestPassword!2026',
          publicMetadata: { role: p.role, e2e: true },
        });
        userId = created.id;
      }
      await sql`
        insert into users (clerk_id, email, role)
        values (${userId}, ${p.email}, ${p.role})
        on conflict (clerk_id) do update set role = excluded.role
      `;
    }
  } finally {
    await sql.end();
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
```

- [ ] **Step 2: Add @clerk/backend if not already a dep**

Run: `pnpm list @clerk/backend`
If not installed: `pnpm add -D @clerk/backend`

- [ ] **Step 3: Inspect the actual users table shape**

Read `src/db/schema/` to confirm the columns are `(clerk_id, email, role)`. If the column names differ (e.g., `clerk_user_id`), update the INSERT statement in the script to match. Do not invent columns.

- [ ] **Step 4: Run the setup**

Prerequisite: copy `.env.e2e.example` to `.env.e2e` and fill in real Clerk test keys + Anthropic key.

```bash
pnpm e2e:setup
```

Expected: prints each step, exits 0. Confirm with:

```bash
docker compose -f e2e/docker-compose.yml exec postgres psql -U postgres -d homeless_e2e \
  -c "select email, role from users where email like '%@e2e.test' order by email;"
```

Expected: 5 rows, one per persona.

- [ ] **Step 5: Commit**

```bash
git add scripts/e2e-setup.mts package.json pnpm-lock.yaml
git commit -m "feat(e2e): setup script — docker up, schema push, seed, clerk users"
```

---

## Task 6: Playwright config and base test fixture

**Files:**
- Create: `e2e/playwright.config.ts`
- Create: `e2e/fixtures/auth.ts`
- Create: `e2e/fixtures/db.ts`
- Create: `e2e/fixtures/test-base.ts`

- [ ] **Step 1: Write the Playwright config**

```ts
import { defineConfig, devices } from '@playwright/test';
import { config as loadEnv } from 'dotenv';

loadEnv({ path: '.env.e2e' });

export default defineConfig({
  testDir: '.',
  fullyParallel: false,        // tests share one DB; run serially for determinism
  workers: 1,
  retries: 0,
  reporter: [
    ['list'],
    ['json', { outputFile: 'e2e/test-results/results.json' }],
    ['html', { outputFolder: 'e2e/.playwright/report', open: 'never' }],
  ],
  use: {
    baseURL: 'http://localhost:3000',
    trace: 'retain-on-failure',
    screenshot: 'only-on-failure',
    video: 'retain-on-failure',
  },
  outputDir: 'e2e/.traces',
  webServer: {
    command: 'pnpm dev',
    url: 'http://localhost:3000',
    timeout: 120_000,
    reuseExistingServer: !process.env.CI,
    env: {
      DATABASE_URL: process.env.DATABASE_URL!,
      NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY: process.env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY!,
      CLERK_SECRET_KEY: process.env.CLERK_SECRET_KEY!,
      ANTHROPIC_API_KEY: process.env.ANTHROPIC_API_KEY!,
      E2E_MOCK_OUTBOUND: '1',
      TWILIO_AUTH_TOKEN: process.env.TWILIO_AUTH_TOKEN!,
      TWILIO_FROM_NUMBER: process.env.TWILIO_FROM_NUMBER!,
      RESEND_API_KEY: process.env.RESEND_API_KEY!,
    },
  },
  projects: [
    { name: 'chromium', use: { ...devices['Desktop Chrome'] } },
  ],
});
```

- [ ] **Step 2: Write the auth fixture**

```ts
// e2e/fixtures/auth.ts
import { type BrowserContext, type Page } from '@playwright/test';
import { clerkSetup, setupClerkTestingToken } from '@clerk/testing/playwright';

export type Persona = 'attorney' | 'coordinator' | 'caseworker' | 'dispatcher' | 'admin';

const EMAIL: Record<Persona, string> = {
  attorney: 'attorney@e2e.test',
  coordinator: 'coordinator@e2e.test',
  caseworker: 'caseworker@e2e.test',
  dispatcher: 'dispatcher@e2e.test',
  admin: 'admin@e2e.test',
};

const PASSWORD = 'E2eTestPassword!2026';

let clerkSetupDone = false;

export async function signInAs(persona: Persona, page: Page, context: BrowserContext): Promise<void> {
  if (!clerkSetupDone) {
    await clerkSetup();
    clerkSetupDone = true;
  }
  await setupClerkTestingToken({ page });

  await page.goto('/sign-in');
  await page.getByLabel('Email address').fill(EMAIL[persona]);
  await page.getByRole('button', { name: /continue/i }).click();
  await page.getByLabel('Password').fill(PASSWORD);
  await page.getByRole('button', { name: /continue|sign in/i }).click();
  // Wait for redirect away from sign-in
  await page.waitForURL((u) => !u.pathname.startsWith('/sign-in'), { timeout: 15_000 });
}
```

- [ ] **Step 3: Add @clerk/testing dep**

Run: `pnpm add -D @clerk/testing`

- [ ] **Step 4: Write the DB fixture**

```ts
// e2e/fixtures/db.ts
import postgres from 'postgres';

export function dbClient() {
  const url = process.env.DATABASE_URL;
  if (!url) throw new Error('DATABASE_URL not set; run pnpm e2e:setup first');
  return postgres(url, { max: 1, idle_timeout: 5 });
}
```

- [ ] **Step 5: Write the extended test base**

```ts
// e2e/fixtures/test-base.ts
import { test as base, expect } from '@playwright/test';
import { type Persona, signInAs } from './auth';

type Fixtures = {
  signInAs: (persona: Persona) => Promise<void>;
};

export const test = base.extend<Fixtures>({
  signInAs: async ({ page, context }, use) => {
    await use(async (persona) => {
      await signInAs(persona, page, context);
    });
  },
});

export { expect };
```

- [ ] **Step 6: Verify Playwright sees the config**

Run: `pnpm exec playwright test --config=e2e/playwright.config.ts --list`
Expected: prints "Total: 0 tests" (no tests yet, but config loads cleanly).

- [ ] **Step 7: Commit**

```bash
git add e2e/playwright.config.ts e2e/fixtures/ package.json pnpm-lock.yaml
git commit -m "feat(e2e): playwright config + auth/db fixtures"
```

---

## Task 7: First green test — minimal smoke (S3 audit log)

**Files:**
- Create: `e2e/smoke/audit-log.spec.ts`

This is the simplest test in the suite — pure DB, no UI, no auth. We do this first to prove the harness end-to-end before building anything heavier.

- [ ] **Step 1: Write the test**

```ts
// e2e/smoke/audit-log.spec.ts
import { test, expect } from '../fixtures/test-base';
import { dbClient } from '../fixtures/db';

test.describe('S3 audit_log append-only', () => {
  test('UPDATE on audit_log fails', async () => {
    const sql = dbClient();
    try {
      // Insert a row first so there's something to attempt updating
      const inserted = await sql`
        insert into audit_log (actor_id, action, resource, meta_json)
        values ('e2e-actor', 'e2e-test', 'audit-log-smoke', '{}')
        returning id
      `;
      const id = inserted[0]?.id;
      expect(id).toBeDefined();

      let threw = false;
      try {
        await sql`update audit_log set action = 'tampered' where id = ${id}`;
      } catch {
        threw = true;
      }
      expect(threw).toBe(true);
    } finally {
      await sql.end();
    }
  });

  test('DELETE on audit_log fails', async () => {
    const sql = dbClient();
    try {
      const inserted = await sql`
        insert into audit_log (actor_id, action, resource, meta_json)
        values ('e2e-actor', 'e2e-test', 'audit-log-smoke-delete', '{}')
        returning id
      `;
      const id = inserted[0]?.id;
      expect(id).toBeDefined();

      let threw = false;
      try {
        await sql`delete from audit_log where id = ${id}`;
      } catch {
        threw = true;
      }
      expect(threw).toBe(true);
    } finally {
      await sql.end();
    }
  });
});
```

- [ ] **Step 2: Verify column names**

Read the actual audit_log schema (`grep -n "audit_log\|auditLog" src/db/schema/`). If columns differ from `(actor_id, action, resource, meta_json)`, update the INSERTs above to match. Do not assume.

- [ ] **Step 3: Run it**

```bash
pnpm e2e
```

Expected: 2 passed.

If FAIL: this is a real product bug — the append-only triggers from PR #228 are not enforcing UPDATE/DELETE rejection. File via Task 19's helper once it's built; for now, note the failure.

- [ ] **Step 4: Commit**

```bash
git add e2e/smoke/audit-log.spec.ts
git commit -m "test(e2e): S3 audit_log append-only smoke"
```

---

## Task 8: S5 — Twilio webhook signature smoke

**Files:**
- Create: `e2e/smoke/twilio-signature.spec.ts`

- [ ] **Step 1: Write the test**

```ts
// e2e/smoke/twilio-signature.spec.ts
import { test, expect } from '../fixtures/test-base';
import { createHmac } from 'node:crypto';

const SMS_URL = 'http://localhost:3000/api/webhooks/twilio/sms';

function twilioSignature(authToken: string, url: string, params: Record<string, string>): string {
  const sortedKeys = Object.keys(params).sort();
  const payload = url + sortedKeys.map((k) => k + params[k]).join('');
  return createHmac('sha1', authToken).update(payload).digest('base64');
}

test.describe('S5 Twilio webhook signature verification', () => {
  test('rejects request with no signature', async ({ request }) => {
    const resp = await request.post(SMS_URL, {
      form: { From: '+15551234567', To: '+15555550100', Body: 'BED' },
    });
    expect(resp.status()).toBe(403);
  });

  test('rejects request with invalid signature', async ({ request }) => {
    const resp = await request.post(SMS_URL, {
      form: { From: '+15551234567', To: '+15555550100', Body: 'BED' },
      headers: { 'X-Twilio-Signature': 'not-a-real-signature' },
    });
    expect(resp.status()).toBe(403);
  });

  test('accepts request with valid signature', async ({ request }) => {
    const params = { From: '+15551234567', To: '+15555550100', Body: 'BED' };
    const sig = twilioSignature(process.env.TWILIO_AUTH_TOKEN!, SMS_URL, params);
    const resp = await request.post(SMS_URL, {
      form: params,
      headers: { 'X-Twilio-Signature': sig },
    });
    expect(resp.status()).toBeLessThan(400);
  });
});
```

- [ ] **Step 2: Verify the signature implementation matches the app's expectations**

Read `src/lib/indc/twilio-signature.ts` (referenced in the test file list). If it normalizes the URL or parameters differently (e.g., trims trailing slash, sorts case-sensitively), mirror that in `twilioSignature()` above.

- [ ] **Step 3: Run**

```bash
pnpm e2e -- e2e/smoke/twilio-signature.spec.ts
```

Expected: 3 passed.

- [ ] **Step 4: Commit**

```bash
git add e2e/smoke/twilio-signature.spec.ts
git commit -m "test(e2e): S5 twilio webhook signature"
```

---

## Task 9: S4 — Role-based access smoke

**Files:**
- Create: `e2e/smoke/role-access.spec.ts`

- [ ] **Step 1: Read the actual nav and access middleware**

Read `src/components/nav/` (or wherever the nav lives — find it via `grep -ln "AppNav\|Sidebar"  src/components/`) and `src/lib/auth.ts`. List which paths each role can hit. The assertions below assume these mappings — adjust them to match the real code, do not invent allowed-list entries.

Working assumptions (verify):
- `attorney` can access `/app/cases/*`. Cannot access `/app/care/*` or `/app/admin/*`.
- `coordinator` can access `/app/care/*`. Cannot access `/app/cases/*` or `/app/admin/*`.
- `caseworker` can access `/app/clients/*`. Cannot access `/app/admin/*`.
- `dispatcher` can access `/app/coalition/sms/*` and `/app/coalition/beds`. Cannot access `/app/cases/*`.
- `admin` (superadmin) can access everything including `/app/admin/*`.

- [ ] **Step 2: Write the test**

```ts
// e2e/smoke/role-access.spec.ts
import { test, expect } from '../fixtures/test-base';

const FORBIDDEN: Record<string, string[]> = {
  attorney: ['/app/care/queue', '/app/admin/users'],
  coordinator: ['/app/cases/filings', '/app/admin/users'],
  caseworker: ['/app/admin/users'],
  dispatcher: ['/app/cases/filings', '/app/admin/users'],
};

const PERMITTED: Record<string, string> = {
  attorney: '/app/cases/triage',
  coordinator: '/app/care/triage',
  caseworker: '/app/clients/triage',
  dispatcher: '/app/coalition/beds',
  admin: '/app/admin/users',
};

for (const [persona, path] of Object.entries(PERMITTED)) {
  test(`S4 ${persona} can reach ${path}`, async ({ page, signInAs }) => {
    await signInAs(persona as never);
    const resp = await page.goto(path);
    expect(resp?.status()).toBeLessThan(400);
  });
}

for (const [persona, paths] of Object.entries(FORBIDDEN)) {
  for (const path of paths) {
    test(`S4 ${persona} blocked from ${path}`, async ({ page, signInAs }) => {
      await signInAs(persona as never);
      const resp = await page.goto(path);
      const status = resp?.status() ?? 0;
      // Either an HTTP error response, or a redirect to a not-authorized page.
      const blocked = status === 403 || status === 404 || page.url().includes('/sign-in') || /not[- ]authori[sz]ed/i.test(await page.content());
      expect(blocked).toBe(true);
    });
  }
}
```

- [ ] **Step 3: Run**

```bash
pnpm e2e -- e2e/smoke/role-access.spec.ts
```

Expected: 12 tests passed (5 permitted + 7 forbidden).

- [ ] **Step 4: Commit**

```bash
git add e2e/smoke/role-access.spec.ts
git commit -m "test(e2e): S4 role-based access matrix"
```

---

## Task 10: S1 — Consent gate smoke

**Files:**
- Create: `e2e/smoke/consent-gate.spec.ts`

- [ ] **Step 1: Read the consent surface**

Read `src/app/p/[ref]/consent/grant/page.tsx` and the corresponding action handler. Identify:
- What ref/token format the URL expects
- What field on the synthetic person row the seed sets so we have a known no-consent person
- What field on the caseworker person view marks data as redacted (e.g., a `data-redacted` attribute, an "Unavailable" string, etc.)

The assertions below use `data-testid="redacted-field"` as the placeholder marker. Replace with whatever the code actually emits.

- [ ] **Step 2: Write the test**

```ts
// e2e/smoke/consent-gate.spec.ts
import { test, expect } from '../fixtures/test-base';
import { dbClient } from '../fixtures/db';

test.describe('S1 consent gate', () => {
  test('caseworker sees redacted view without consent; full view after grant', async ({ page, signInAs }) => {
    const sql = dbClient();
    let personRef: string;
    try {
      const rows = await sql`
        select ref from synthetic_persons
        where ref not in (select person_ref from consent_records where status = 'granted')
        limit 1
      `;
      expect(rows.length).toBeGreaterThan(0);
      personRef = rows[0]!.ref;
    } finally {
      await sql.end();
    }

    await signInAs('caseworker');
    await page.goto(`/app/clients/person/${personRef}`);

    // Pre-consent: redacted markers present, sensitive fields absent.
    await expect(page.getByTestId('consent-status')).toHaveText(/no consent|not granted/i);
    expect(await page.getByTestId('redacted-field').count()).toBeGreaterThan(0);

    // Grant consent via the public consent surface.
    await page.goto(`/p/${personRef}/consent/grant`);
    await page.getByLabel(/I authorize/i).check();
    await page.getByRole('button', { name: /grant|submit|i agree/i }).click();
    await expect(page.getByText(/consent recorded|thank you/i)).toBeVisible({ timeout: 10_000 });

    // Re-fetch caseworker view: no redacted markers.
    await signInAs('caseworker'); // re-establish caseworker session
    await page.goto(`/app/clients/person/${personRef}`);
    await expect(page.getByTestId('consent-status')).toHaveText(/granted|active/i);
    expect(await page.getByTestId('redacted-field').count()).toBe(0);
  });
});
```

- [ ] **Step 3: Adjust selectors to match actual DOM**

Open the rendered person page with `--ui` mode (`pnpm e2e:ui`) and inspect the actual data-testid values, headings, and button labels. Update the selectors to exactly what the app renders.

- [ ] **Step 4: Run**

```bash
pnpm e2e -- e2e/smoke/consent-gate.spec.ts
```

Expected: 1 passed.

- [ ] **Step 5: Commit**

```bash
git add e2e/smoke/consent-gate.spec.ts
git commit -m "test(e2e): S1 consent gate redact -> grant -> visible"
```

---

## Task 11: S2 — DV-blind redaction smoke

**Files:**
- Create: `e2e/smoke/dv-blind.spec.ts`

- [ ] **Step 1: Identify a DV-flagged synthetic person**

The seed should have at least one `dv_flag = true` row. Confirm with:

```bash
docker compose -f e2e/docker-compose.yml exec postgres psql -U postgres -d homeless_e2e \
  -c 'select ref from synthetic_persons where dv_flag = true limit 3;'
```

If none exist, modify the seed before this task lands. (Adding one row is trivial; do it as part of this commit.)

- [ ] **Step 2: Write the test**

```ts
// e2e/smoke/dv-blind.spec.ts
import { test, expect } from '../fixtures/test-base';
import { dbClient } from '../fixtures/db';

const LOCATION_PATTERNS = [
  /\d{1,5}\s+\w+\s+(?:St|Ave|Rd|Blvd|Dr|Ln|Way|Cir|Ct|Pl)\.?/i,
  /\b\d{5}(?:-\d{4})?\b/, // ZIP
  /Owensboro|Whitesville|Philpot|Maceo|Daviess/i,
];

test.describe('S2 DV-blind redaction', () => {
  test('dv-flagged person never surfaces location across views', async ({ page, signInAs }) => {
    const sql = dbClient();
    let dvRef: string;
    try {
      const rows = await sql`select ref from synthetic_persons where dv_flag = true limit 1`;
      expect(rows.length).toBe(1);
      dvRef = rows[0]!.ref;
    } finally {
      await sql.end();
    }

    const surfaces: Array<{ persona: 'caseworker' | 'coordinator' | 'dispatcher'; path: string }> = [
      { persona: 'caseworker', path: `/app/clients/person/${dvRef}` },
      { persona: 'coordinator', path: `/app/care/patients/${dvRef}` },
      { persona: 'dispatcher', path: `/app/coalition/beds` },
    ];

    for (const { persona, path } of surfaces) {
      await signInAs(persona);
      const resp = await page.goto(path);
      if ((resp?.status() ?? 0) >= 400) continue; // route may not include this person — allowed
      const html = await page.content();
      for (const pat of LOCATION_PATTERNS) {
        expect(html, `${persona} at ${path} leaked location pattern ${pat}`).not.toMatch(pat);
      }
    }
  });
});
```

- [ ] **Step 3: Run**

```bash
pnpm e2e -- e2e/smoke/dv-blind.spec.ts
```

Expected: 1 passed. If FAIL, capture the leaked pattern and the persona/path — that's a real DV-blind regression.

- [ ] **Step 4: Commit**

```bash
git add e2e/smoke/dv-blind.spec.ts
git commit -m "test(e2e): S2 dv-blind redaction across surfaces"
```

---

## Task 12: S6 — Bed-hold expiration smoke

**Files:**
- Create: `e2e/smoke/bed-hold-expiration.spec.ts`

- [ ] **Step 1: Read the bed-hold release Inngest function**

Locate the function — likely `src/inngest/functions/bed-hold-expire.ts` or similar. Identify:
- Whether it queries by `expires_at <= now()` (in which case we can age the row directly) or by some other mechanism
- Whether there's an HTTP route that triggers the function on demand for tests

If no on-demand trigger exists, skip the function-trigger step and just call the underlying release helper directly via a tiny Node script — but only if that helper is exported. If neither, this task ships behind a small app-side change: add a `POST /api/test/run-bed-hold-expiry` route gated on `process.env.E2E_MOCK_OUTBOUND === '1'` that invokes the same logic as the cron.

- [ ] **Step 2: Write the test (assuming aging-the-row + on-demand trigger)**

```ts
// e2e/smoke/bed-hold-expiration.spec.ts
import { test, expect } from '../fixtures/test-base';
import { dbClient } from '../fixtures/db';

test.describe('S6 bed-hold expiration', () => {
  test('hold older than 90 minutes is auto-released', async ({ request }) => {
    const sql = dbClient();
    let holdId: number;
    try {
      const shelters = await sql`select id from shelters limit 1`;
      expect(shelters.length).toBe(1);
      const shelterId = shelters[0]!.id;

      const created = await sql`
        insert into bed_holds (shelter_id, status, expires_at, created_at)
        values (${shelterId}, 'active', now() + interval '90 minutes', now())
        returning id
      `;
      holdId = created[0]!.id;

      // Age the row so its expires_at is in the past.
      await sql`update bed_holds set expires_at = now() - interval '1 minute' where id = ${holdId}`;

      // Trigger the expiry job.
      const resp = await request.post('http://localhost:3000/api/test/run-bed-hold-expiry');
      expect(resp.status()).toBeLessThan(400);

      const after = await sql`select status from bed_holds where id = ${holdId}`;
      expect(after[0]!.status).toBe('released');
    } finally {
      await sql.end();
    }
  });
});
```

- [ ] **Step 3: If the test-trigger route doesn't exist, add it**

Create `src/app/api/test/run-bed-hold-expiry/route.ts`:

```ts
import { NextResponse } from 'next/server';
import { releaseExpiredHolds } from '@/lib/coordination/bed-availability'; // adjust import to actual location

export async function POST() {
  if (process.env.E2E_MOCK_OUTBOUND !== '1') {
    return new NextResponse('forbidden', { status: 403 });
  }
  const result = await releaseExpiredHolds();
  return NextResponse.json(result);
}
```

If `releaseExpiredHolds` (or whatever the equivalent is) is not exported, export it from its module. Do not duplicate the logic — call into the same code the Inngest function calls.

- [ ] **Step 4: Run**

```bash
pnpm e2e -- e2e/smoke/bed-hold-expiration.spec.ts
```

Expected: 1 passed.

- [ ] **Step 5: Commit**

```bash
git add e2e/smoke/bed-hold-expiration.spec.ts src/app/api/test/run-bed-hold-expiry/
git commit -m "test(e2e): S6 bed-hold expiration via on-demand trigger"
```

---

## Task 13: J1 — KLA attorney persona journey

**Files:**
- Create: `e2e/journeys/kla-attorney.spec.ts`

- [ ] **Step 1: Walk the journey manually first**

In `pnpm e2e:ui` (or just `pnpm dev` against the e2e DB), sign in as `attorney@e2e.test` and walk the full journey by hand. Note exact headings, button labels, URL patterns, and form fields. Replace any selector below that doesn't match the actual DOM.

- [ ] **Step 2: Write the journey**

```ts
// e2e/journeys/kla-attorney.spec.ts
import { test, expect } from '../fixtures/test-base';
import { dbClient } from '../fixtures/db';

test('J1 KLA attorney morning triage → packet → status', async ({ page, signInAs }) => {
  await signInAs('attorney');

  // 1. Land on the docket dashboard.
  await page.goto('/app/cases/triage');
  await expect(page.getByRole('heading', { name: /attorney triage|today/i })).toBeVisible();

  // 2. Open the highest-risk filing.
  const firstCard = page.getByTestId('filing-card').first();
  await expect(firstCard).toBeVisible();
  await firstCard.click();
  await expect(page).toHaveURL(/\/app\/cases\/filings\/[^/]+$/);

  // 3. Ask Claude about this case (PR #287).
  await page.getByRole('button', { name: /ask claude|case q&a/i }).click();
  await page.getByPlaceholder(/ask a question/i).fill('Are there any procedural defects in this filing?');
  await page.getByRole('button', { name: /send|ask/i }).click();
  await expect(page.getByTestId('case-qa-answer')).toBeVisible({ timeout: 30_000 });

  // 4. Generate AI-drafted outreach letter (PR #285).
  await page.getByRole('button', { name: /draft outreach|outreach letter/i }).click();
  await expect(page.getByTestId('outreach-letter-draft')).toContainText(/dear/i, { timeout: 30_000 });

  // 5. Export packet PDF.
  const [download] = await Promise.all([
    page.waitForEvent('download'),
    page.getByRole('link', { name: /packet pdf|export/i }).click(),
  ]);
  expect(download.suggestedFilename()).toMatch(/\.pdf$/);
  const pdfBuffer = await download.createReadStream().then(async (s) => {
    if (!s) return Buffer.alloc(0);
    const chunks: Buffer[] = [];
    for await (const c of s) chunks.push(c as Buffer);
    return Buffer.concat(chunks);
  });
  expect(pdfBuffer.length).toBeGreaterThan(1000);
  expect(pdfBuffer.subarray(0, 4).toString()).toBe('%PDF');

  // 6. Mark case status.
  await page.getByRole('button', { name: /mark responded|update status/i }).click();
  await page.getByLabel(/status/i).selectOption('responded');
  await page.getByRole('button', { name: /save|confirm/i }).click();
  await expect(page.getByTestId('case-status-badge')).toHaveText(/responded/i);

  // 7. Verify the audit log captured the AI draft generation.
  const sql = dbClient();
  try {
    const rows = await sql`
      select count(*)::int as n from audit_log
      where action like '%outreach%' and created_at > now() - interval '5 minutes'
    `;
    expect(rows[0]!.n).toBeGreaterThan(0);
  } finally {
    await sql.end();
  }
});
```

- [ ] **Step 3: Run**

```bash
pnpm e2e -- e2e/journeys/kla-attorney.spec.ts
```

Expected: 1 passed.

- [ ] **Step 4: Commit**

```bash
git add e2e/journeys/kla-attorney.spec.ts
git commit -m "test(e2e): J1 KLA attorney morning journey"
```

---

## Task 14: J2 — OH care coordinator journey

**Files:**
- Create: `e2e/journeys/oh-coordinator.spec.ts`

- [ ] **Step 1: Walk it manually as `coordinator@e2e.test`** to capture real selectors.

- [ ] **Step 2: Write the journey**

```ts
// e2e/journeys/oh-coordinator.spec.ts
import { test, expect } from '../fixtures/test-base';
import { dbClient } from '../fixtures/db';

test('J2 OH care coordinator triage → care plan → refer', async ({ page, signInAs }) => {
  await signInAs('coordinator');

  // 1. ED morning triage (PR #294).
  await page.goto('/app/care/triage');
  await expect(page.getByRole('heading', { name: /ed morning triage/i })).toBeVisible();

  // 2. Open super-utilizer queue (ESUC-009).
  await page.goto('/app/care/queue');
  await expect(page.getByTestId('patient-row').first()).toBeVisible();

  // 3. Open patient detail.
  await page.getByTestId('patient-row').first().click();
  await expect(page).toHaveURL(/\/app\/care\/patients\/[^/]+$/);
  const patientUrl = page.url();

  // 4. Ask Claude about this patient (PR #297).
  await page.getByRole('button', { name: /ask claude|patient q&a/i }).click();
  await page.getByPlaceholder(/ask a question/i).fill('What interventions reduced re-admit rate for similar patients?');
  await page.getByRole('button', { name: /send|ask/i }).click();
  await expect(page.getByTestId('patient-qa-answer')).toBeVisible({ timeout: 30_000 });

  // 5. Batch care-plan draft (PR #298).
  await page.goto('/app/care/triage');
  await page.getByRole('button', { name: /batch care plan|draft plans/i }).click();
  await expect(page.getByTestId('batch-progress')).toBeVisible();
  await expect(page.getByText(/drafted \d+ plan/i)).toBeVisible({ timeout: 60_000 });

  // 6. Refer to caseworker (PR #300).
  await page.goto(patientUrl);
  await page.getByRole('button', { name: /refer to caseworker/i }).click();
  await page.getByLabel(/reason|note/i).fill('Recuperative care candidate; needs SDOH support.');
  await page.getByRole('button', { name: /submit referral|refer/i }).click();
  await expect(page.getByText(/referral sent|added to caseworker queue/i)).toBeVisible();

  // 7. Verify the referral row exists.
  const sql = dbClient();
  try {
    const rows = await sql`
      select count(*)::int as n from referrals
      where created_at > now() - interval '5 minutes'
    `;
    expect(rows[0]!.n).toBeGreaterThan(0);
  } finally {
    await sql.end();
  }
});
```

- [ ] **Step 3: Run + commit**

```bash
pnpm e2e -- e2e/journeys/oh-coordinator.spec.ts
git add e2e/journeys/oh-coordinator.spec.ts
git commit -m "test(e2e): J2 OH care coordinator journey"
```

---

## Task 15: J3 — Caseworker journey

**Files:**
- Create: `e2e/journeys/caseworker.spec.ts`

- [ ] **Step 1: Walk it manually as `caseworker@e2e.test`**.

- [ ] **Step 2: Write the journey**

```ts
// e2e/journeys/caseworker.spec.ts
import { test, expect } from '../fixtures/test-base';
import { dbClient } from '../fixtures/db';

test('J3 caseworker morning → person → benefits → note → doc upload', async ({ page, signInAs }) => {
  await signInAs('caseworker');

  // 1. Morning triage (PR #295).
  await page.goto('/app/clients/morning');
  await expect(page.getByRole('heading', { name: /morning|today/i })).toBeVisible();

  // 2. Open a person view.
  await page.goto('/app/clients/triage');
  await page.getByTestId('person-row').first().click();
  await expect(page).toHaveURL(/\/app\/clients\/person\/[^/]+$/);
  const personUrl = page.url();

  // 3. Pre-meeting briefing (PR #283 / CWT-012).
  await page.getByRole('button', { name: /pre[- ]meeting briefing|briefing/i }).click();
  await expect(page.getByTestId('briefing-content')).toBeVisible({ timeout: 30_000 });

  // 4. Benefits screener (CWT-007).
  await page.goto('/app/clients/screener');
  await page.getByLabel(/household size/i).fill('3');
  await page.getByLabel(/monthly income/i).fill('1200');
  await page.getByRole('button', { name: /screen|run/i }).click();
  await expect(page.getByTestId('benefits-result')).toContainText(/SNAP|KCHIP/i);

  // 5. Post-meeting note (PR #296).
  await page.goto(personUrl);
  await page.getByRole('button', { name: /post[- ]meeting note|record note/i }).click();
  await page.getByPlaceholder(/dictate|type your note/i).fill(
    'Met with client today. Discussed SNAP application status. Provided KY ID recovery referral.',
  );
  await page.getByRole('button', { name: /structure|generate|save/i }).click();
  await expect(page.getByTestId('structured-note')).toBeVisible({ timeout: 30_000 });

  // 6. Document upload + AI extraction (PR #278 / CWT-021).
  await page.goto('/app/clients/documents/new');
  // Use a tiny fixture PDF committed under e2e/fixtures/sample-id.pdf (Task 17 commits this).
  await page.setInputFiles('input[type=file]', 'e2e/fixtures/sample-id.pdf');
  await page.getByRole('button', { name: /upload|extract/i }).click();
  await expect(page.getByTestId('extraction-result')).toBeVisible({ timeout: 60_000 });

  // 7. Confirm document row.
  const sql = dbClient();
  try {
    const rows = await sql`select count(*)::int as n from client_documents where created_at > now() - interval '5 minutes'`;
    expect(rows[0]!.n).toBeGreaterThan(0);
  } finally {
    await sql.end();
  }
});
```

- [ ] **Step 3: Add a small fixture PDF**

```bash
# Generate a minimal valid PDF for the upload step
pnpm tsx -e "
  const PDFDocument = require('pdfkit');
  const fs = require('fs');
  const doc = new PDFDocument();
  doc.pipe(fs.createWriteStream('e2e/fixtures/sample-id.pdf'));
  doc.fontSize(14).text('STATE OF KENTUCKY OPERATOR LICENSE');
  doc.text('NAME: TEST E PERSON');
  doc.text('DOB: 01/15/1985');
  doc.text('LIC: K000-00-000');
  doc.end();
"
```

- [ ] **Step 4: Run + commit**

```bash
pnpm e2e -- e2e/journeys/caseworker.spec.ts
git add e2e/journeys/caseworker.spec.ts e2e/fixtures/sample-id.pdf
git commit -m "test(e2e): J3 caseworker journey + sample PDF fixture"
```

---

## Task 16: J4 — 211 dispatcher SMS round-trip

**Files:**
- Create: `e2e/journeys/dispatcher-sms.spec.ts`

- [ ] **Step 1: Read `src/app/api/webhooks/twilio/sms/route.ts`** to confirm the inbound payload format and the response shape (TwiML XML or JSON).

- [ ] **Step 2: Write the journey**

```ts
// e2e/journeys/dispatcher-sms.spec.ts
import { test, expect } from '../fixtures/test-base';
import { dbClient } from '../fixtures/db';
import { createHmac } from 'node:crypto';

const SMS_URL = 'http://localhost:3000/api/webhooks/twilio/sms';

function twilioSig(token: string, url: string, params: Record<string, string>): string {
  const sortedKeys = Object.keys(params).sort();
  return createHmac('sha1', token)
    .update(url + sortedKeys.map((k) => k + params[k]).join(''))
    .digest('base64');
}

test('J4 dispatcher SMS BED FAMILY round-trip + dashboard reflection', async ({ request, page, signInAs }) => {
  const params = { From: '+15551230001', To: '+15555550100', Body: 'BED FAMILY' };
  const sig = twilioSig(process.env.TWILIO_AUTH_TOKEN!, SMS_URL, params);

  const resp = await request.post(SMS_URL, {
    form: params,
    headers: { 'X-Twilio-Signature': sig },
  });
  expect(resp.status()).toBeLessThan(400);
  const replyBody = await resp.text();
  // TwiML or JSON — assert it mentions a shelter that accepts families.
  expect(replyBody).toMatch(/family|bed|shelter/i);

  // The interceptor recorded the outbound reply, OR the route stores the lookup directly.
  const sql = dbClient();
  try {
    const lookups = await sql`
      select count(*)::int as n from sms_lookups where from_number = ${params.From}
    `;
    expect(lookups[0]!.n).toBeGreaterThan(0);
  } finally {
    await sql.end();
  }

  // Dispatcher dashboard shows the lookup.
  await signInAs('dispatcher');
  await page.goto('/app/coalition/sms');
  await expect(page.getByText(params.From)).toBeVisible({ timeout: 10_000 });
});
```

If the app does not expose an `sms_lookups` table (column names will likely differ), update the SQL to match the real audit/log table that the SMS handler writes to. Do not invent.

- [ ] **Step 3: Run + commit**

```bash
pnpm e2e -- e2e/journeys/dispatcher-sms.spec.ts
git add e2e/journeys/dispatcher-sms.spec.ts
git commit -m "test(e2e): J4 dispatcher SMS round-trip"
```

---

## Task 17: J5 — Coalition admin journey

**Files:**
- Create: `e2e/journeys/coalition-admin.spec.ts`

- [ ] **Step 1: Walk it manually as `admin@e2e.test`**.

- [ ] **Step 2: Write the journey**

```ts
// e2e/journeys/coalition-admin.spec.ts
import { test, expect } from '../fixtures/test-base';

test('J5 coalition admin: comms banner → transparency → narrative → fiscal court PDF', async ({ page, signInAs }) => {
  await signInAs('admin');

  // 1. Publish a comms banner (PR #280, OPRT-010).
  await page.goto('/app/coalition/comms/new');
  await page.getByLabel(/headline|title/i).fill('e2e test banner — sprint validation');
  await page.getByLabel(/body|message/i).fill('This banner was published by the e2e suite.');
  await page.getByRole('button', { name: /publish|save/i }).click();
  await expect(page.getByText(/published|active/i)).toBeVisible();

  // 2. Verify the banner is now visible globally — go to a different page and assert it renders.
  await page.goto('/app/dashboard');
  await expect(page.getByText('e2e test banner')).toBeVisible();

  // 3. Transparency report (DTRS-013, PR #276).
  await page.goto('/outcomes');
  await expect(page.getByRole('heading', { name: /transparency|outcomes/i })).toBeVisible();

  // 4. Trigger AI quarterly narrative (PR #303).
  await page.getByRole('button', { name: /generate narrative|ai narrative/i }).click();
  await expect(page.getByTestId('quarterly-narrative')).toBeVisible({ timeout: 60_000 });

  // 5. Fiscal court brief PDF (PCYI-001, PR #279).
  const [download] = await Promise.all([
    page.waitForEvent('download'),
    page.goto('/outcomes/fiscal-court/2026/Q1').then(() => page.getByRole('link', { name: /download pdf/i }).click()),
  ]);
  const pdfStream = await download.createReadStream();
  let bytes = 0;
  if (pdfStream) {
    for await (const c of pdfStream) bytes += (c as Buffer).length;
  }
  expect(bytes).toBeGreaterThan(1000);
});
```

- [ ] **Step 3: Run + commit**

```bash
pnpm e2e -- e2e/journeys/coalition-admin.spec.ts
git add e2e/journeys/coalition-admin.spec.ts
git commit -m "test(e2e): J5 coalition admin journey"
```

---

## Task 18: Bug-filing helper (`pnpm e2e:report`)

**Files:**
- Create: `scripts/e2e-report.mts`

- [ ] **Step 1: Write the script**

```ts
#!/usr/bin/env tsx
/**
 * Reads e2e/test-results/results.json (Playwright JSON reporter output)
 * and, for each failed test, drafts a `gh issue create` invocation
 * the user can review and confirm before filing.
 */
import { readFileSync, existsSync } from 'node:fs';
import { execSync } from 'node:child_process';
import * as readline from 'node:readline/promises';

type Suite = { title?: string; suites?: Suite[]; specs?: Spec[] };
type Spec = { title: string; file: string; line: number; tests: TestRun[] };
type TestRun = { results: TestResult[]; status: string };
type TestResult = { status: string; error?: { message?: string }; attachments?: { name: string; path?: string }[] };

const REPORT = 'e2e/test-results/results.json';

function epicFromPath(path: string): string {
  if (path.includes('kla-attorney') || path.includes('eviction')) return 'epic:evdt';
  if (path.includes('coordinator') || path.includes('care')) return 'epic:esuc';
  if (path.includes('caseworker') || path.includes('cwt')) return 'epic:cwt';
  if (path.includes('dispatcher') || path.includes('sms')) return 'epic:coor';
  if (path.includes('admin') || path.includes('outcomes')) return 'epic:oprt';
  if (path.includes('consent') || path.includes('dv-blind') || path.includes('audit')) return 'epic:dtrs';
  return 'epic:fnd';
}

function walk(suite: Suite, into: Spec[]): void {
  for (const s of suite.specs ?? []) into.push(s);
  for (const child of suite.suites ?? []) walk(child, into);
}

async function main() {
  if (!existsSync(REPORT)) {
    console.error(`No ${REPORT} found. Run pnpm e2e first.`);
    process.exit(1);
  }
  const report = JSON.parse(readFileSync(REPORT, 'utf8'));
  const specs: Spec[] = [];
  for (const suite of report.suites ?? []) walk(suite, specs);

  const failed = specs.filter((s) =>
    s.tests.some((t) => t.results.some((r) => r.status === 'failed' || r.status === 'timedOut')),
  );

  if (failed.length === 0) {
    console.log('No failures to report — nothing to do.');
    return;
  }

  const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
  for (const spec of failed) {
    const firstError = spec.tests[0]?.results[0]?.error?.message ?? '(no error message)';
    const tracePath = spec.tests[0]?.results[0]?.attachments?.find((a) => a.name === 'trace')?.path ?? '(no trace)';
    const epic = epicFromPath(spec.file);
    const id = spec.title.match(/^[JS]\d+/)?.[0] ?? 'TEST';
    const title = `[e2e] ${id} — ${spec.title.slice(0, 80)}`;
    const body = [
      `Failing test: ${spec.file}:${spec.line}`,
      ``,
      `Error:`,
      '```',
      firstError.slice(0, 2000),
      '```',
      ``,
      `Trace: ${tracePath}`,
      ``,
      `Filed automatically by pnpm e2e:report.`,
    ].join('\n');

    console.log('\n---');
    console.log(`Title:  ${title}`);
    console.log(`Labels: bug, e2e, ${epic}`);
    console.log(`Body:`);
    console.log(body);
    const ans = (await rl.question('\nFile this issue? [y/N] ')).trim().toLowerCase();
    if (ans === 'y' || ans === 'yes') {
      execSync(
        `gh issue create --title ${JSON.stringify(title)} --body ${JSON.stringify(body)} --label bug --label e2e --label ${epic}`,
        { stdio: 'inherit' },
      );
    } else {
      console.log('skipped.');
    }
  }
  rl.close();
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
```

- [ ] **Step 2: Smoke-test the helper**

Force a failure (temporarily edit any test to assert `expect(true).toBe(false)`), run `pnpm e2e`, then `pnpm e2e:report`. Confirm the prompt appears and you can answer `n` to skip without filing. Revert the test edit.

- [ ] **Step 3: Commit**

```bash
git add scripts/e2e-report.mts
git commit -m "feat(e2e): pnpm e2e:report — gh issue drafter for failures"
```

---

## Task 19: e2e README

**Files:**
- Create: `e2e/README.md`

- [ ] **Step 1: Write it**

```markdown
# e2e tests

Playwright-driven end-to-end tests for the Daviess Coalition Platform.

## Running

1. Copy `.env.e2e.example` → `.env.e2e` and fill in:
   - Your **Clerk test instance** keys (do not use production)
   - An Anthropic API key (used to populate the cache on first run only)
2. Run the suite:

   ```bash
   pnpm e2e
   ```

   This runs `pnpm e2e:setup` (docker up + schema push + seed + Clerk users), starts `next dev`, runs all tests, and tears down on exit.

3. Iterate on a single test:

   ```bash
   pnpm e2e:ui                 # Playwright UI mode against the e2e DB
   pnpm e2e -- path/to/spec    # one spec only
   ```

4. After a failed run, file bugs:

   ```bash
   pnpm e2e:report             # interactive — drafts gh issue per failure
   ```

## Architecture

- **Database:** isolated `postgres:16-alpine` in `e2e/docker-compose.yml` on port `5433`. Volume is `tmpfs`, so each `down -v` is fully clean.
- **Outbound mocking:** when `E2E_MOCK_OUTBOUND=1` (set automatically by Playwright), `instrumentation.ts` patches `fetch` to:
  - Cache Anthropic responses to `e2e/.cache/ai/<sha256>.json`. Forces `claude-haiku-4-5`.
  - Record Twilio + Resend payloads to the `outbound_messages_test` table.
- **Auth:** Five Clerk test users (`{role}@e2e.test`) provisioned by `scripts/e2e-setup.mts`. Tests sign in via the persona fixture in `e2e/fixtures/auth.ts`.

## Refreshing the AI cache

When a prompt changes (in `src/ai/prompts/*.ts`), the SHA-256 changes and the cache misses on the next run. Just re-run `pnpm e2e` with a working `ANTHROPIC_API_KEY`. The new response is saved.

To force a full refresh: `rm -rf e2e/.cache/ai/`.

## Adding a test

1. Decide journey (`e2e/journeys/`) or smoke (`e2e/smoke/`).
2. Use the persona signin via `signInAs(...)` from `fixtures/test-base.ts`.
3. Each test starts with a unique short id (`J1`, `S5`, etc.) declared in the test name — this is what shows up in the auto-filed bug title.

## Failure → bug workflow

1. Run `pnpm e2e`. If anything fails, Playwright keeps the trace at `e2e/.traces/`.
2. Run `pnpm e2e:report`. For each failure, the script prompts: review the title and body, then `y` to file with `gh`.
3. The issue is filed with labels `bug`, `e2e`, `epic:<inferred>`. Project board: stays at `Todo` per `CLAUDE.md`.

## Caveats

- **Sequential by design.** All tests share one DB; running parallel would cause flake. `workers: 1` in `playwright.config.ts`.
- **Don't run against production Clerk.** The setup script creates and modifies users — only point it at a Clerk test instance.
- **First run hits the Anthropic API** to populate the cache. Subsequent runs are offline.
```

- [ ] **Step 2: Commit**

```bash
git add e2e/README.md
git commit -m "docs(e2e): add e2e README"
```

---

## Task 20: Full-suite validation

This is the final gate. The suite must run cleanly twice in a row from a clean checkout.

- [ ] **Step 1: Tear down completely and re-run from scratch**

```bash
docker compose -f e2e/docker-compose.yml down -v
rm -rf e2e/.cache/ai e2e/.traces e2e/test-results
pnpm e2e
```

Expected: 11 tests passed total (5 journeys + 6 smoke; S4 contributes multiple cases but counts as one spec). If any fail, do NOT modify the test — file via `pnpm e2e:report` and continue.

- [ ] **Step 2: Run again immediately to verify cache replay works**

```bash
pnpm e2e
```

Expected: same passes, much faster on AI-heavy tests (cache hits).

- [ ] **Step 3: Triage any genuine failures**

For each failure that reflects a real bug:

```bash
pnpm e2e:report
```

Confirm each issue, file with `gh`. Per `CLAUDE.md`, leave them at `Todo` on the project board.

- [ ] **Step 4: Open the PR**

```bash
git push -u origin phase1/QA-001-e2e-suite
gh pr create --title "feat(QA-001): e2e test suite — playwright + 11 tests" --body "$(cat <<'EOF'
## Summary

- Playwright e2e harness with isolated Postgres in Docker
- Single instrumentation hook intercepts Anthropic / Twilio / Resend (no business-logic changes)
- 5 persona journeys covering KLA attorney, OH care coordinator, caseworker, 211 dispatcher, coalition admin
- 6 targeted smoke tests at risky cross-story seams (consent, DV-blind, audit-log, role access, twilio sig, bed-hold expiry)
- `pnpm e2e:report` drafts `bug`-labeled issues per failure

## How to run

See `e2e/README.md`. Requires `.env.e2e` with Clerk test keys + Anthropic key.

## Test plan

- [x] `pnpm e2e` runs cleanly twice in a row
- [x] Cache replay works (second run is faster)
- [x] Bugs filed for any genuine failures: see linked issues

🤖 Generated with [Claude Code](https://claude.com/claude-code)
EOF
)"
```

- [ ] **Step 5: Final commit (if any tweaks made during validation)**

```bash
git add -A
git commit -m "chore(e2e): validation pass — green"
```

---

## Summary of files added/changed

**Application code (production-safe additions):**
- `src/db/schema/outbound-messages-test.ts` — new table for test-mode outbound recording
- `src/lib/e2e/intercept.ts` — fetch interceptor (no-op unless `E2E_MOCK_OUTBOUND=1`)
- `src/instrumentation.ts` — wires interceptor on server startup
- `src/app/api/test/run-bed-hold-expiry/route.ts` — test-mode-only trigger for S6 (gated on `E2E_MOCK_OUTBOUND`)
- `drizzle/<NNNN>_*.sql` — generated migration

**Test harness:**
- `e2e/docker-compose.yml`, `e2e/playwright.config.ts`, `e2e/fixtures/*`
- `e2e/journeys/*.spec.ts` × 5
- `e2e/smoke/*.spec.ts` × 6
- `e2e/README.md`
- `e2e/fixtures/sample-id.pdf`

**Scripts:**
- `scripts/e2e-setup.mts`, `scripts/e2e-report.mts`

**Config:**
- `package.json` — scripts + devDeps
- `.gitignore`, `.env.e2e.example`
