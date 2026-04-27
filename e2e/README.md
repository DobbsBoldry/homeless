# e2e tests

Playwright-driven end-to-end tests for the Daviess Coalition Platform.
Hybrid suite: 5 persona journeys (the spine) + 6 targeted smoke tests
(the seams).

## Running

1. Copy `.env.e2e.example` → `.env.e2e` and fill in:
   - Your **Clerk test instance** keys (`pk_test_…`, `sk_test_…`) — never production
   - An Anthropic API key (used to populate the response cache on first run only)

2. Run the suite:

   ```bash
   pnpm e2e
   ```

   This runs `pnpm e2e:setup` (docker up + schema apply + seed + Clerk
   test users + fixture data), starts `next dev` on port 3000, runs all
   tests serially, and tears down on exit.

3. Iterate on a single spec or a single test:

   ```bash
   pnpm e2e:ui                                      # Playwright UI mode
   pnpm exec playwright test --config=e2e/playwright.config.ts e2e/smoke/audit-log.spec.ts
   pnpm exec playwright test --config=e2e/playwright.config.ts -g "S5"
   ```

4. After a run with failures:

   ```bash
   pnpm e2e:report          # interactive — drafts a `bug`-labeled issue per failure
   pnpm e2e:report --yes    # file all without prompting (use sparingly)
   ```

## Architecture

- **Database:** isolated `postgres:16-alpine` in `e2e/docker-compose.yml`,
  port `5434`. Volume is `tmpfs`, so each `down -v` is fully clean.
- **Migrations:** `scripts/e2e-migrate.mts` applies each migration in its
  own transaction (the upstream Drizzle migrator wraps everything in one
  tx, which trips PG's "new enum values must be committed before use"
  rule on cold-start runs).
- **Outbound interception:** when `E2E_MOCK_OUTBOUND=1` (set automatically
  by Playwright), `instrumentation.ts` patches global `fetch` once at
  server startup:
  - **Anthropic:** caches responses to `e2e/.cache/ai/<sha256>.json`,
    keyed by request body. Forces `model: "claude-haiku-4-5"`.
    Re-records on cache miss when the model has a working API key.
  - **Twilio + Resend:** payloads recorded to `outbound_messages_test`
    table. Synthetic success response returned to the caller, so app
    code doesn't need to know it's being intercepted.
- **Auth:** five Clerk test users provisioned in the test instance by
  `scripts/e2e-setup.mts`. `e2e/fixtures/auth.ts` calls Clerk's
  ticket-based programmatic sign-in helper to bypass the UI flow
  entirely (handles bot detection, MFA gates, etc.).

## Personas

Each persona maps to a seeded role plus the Clerk test user with a
matching email:

| Persona      | Email                          | Seed role        |
|--------------|--------------------------------|------------------|
| `attorney`   | attorney+e2e@example.com       | `attorney` + KLA |
| `caseworker` | caseworker+e2e@example.com     | `caseworker`     |
| `coordinator`| coordinator+e2e@example.com    | `ed_coordinator` |
| `shelter`    | shelter+e2e@example.com        | `shelter_staff`  |
| `admin`      | admin+e2e@example.com          | `admin`          |

In a test:

```ts
import { test, expect } from '../fixtures/test-base';

test('does the thing', async ({ page, signInAs }) => {
  await signInAs('attorney');
  await page.goto('/app/cases/triage');
  // ...
});
```

## Refreshing the AI cache

When a prompt template in `src/ai/prompts/*.ts` changes, the SHA-256 of
the request body changes and the cache misses on the next run. With a
working `ANTHROPIC_API_KEY`, the next run records a fresh response.

To force a full refresh: `rm -rf e2e/.cache/ai/`.

## Adding a test

1. Decide whether it's a journey (`e2e/journeys/`) or a smoke
   (`e2e/smoke/`).
   - **Journeys** = persona-based long flows. Each one exercises 4–8
     steps spanning multiple stories. Failure = a workflow regression.
   - **Smoke** = single-purpose checks at risky cross-story seams. One
     focused assertion per test.
2. Use the persona fixture from `e2e/fixtures/test-base.ts`.
3. Prefix the test name with a short id (`J1`, `S5`, etc.). The id ends
   up in the auto-filed bug title and the project board.

## Failure → bug workflow

1. Run `pnpm e2e`. Failed tests leave a Playwright trace at
   `e2e/.traces/<test>/trace.zip`.
2. Run `pnpm e2e:report`. For each failure the script previews the bug
   title and body, then prompts y/N to file via `gh`.
3. Issues are filed with labels `bug`, `e2e`, plus the inferred
   `epic:*` label. Project board status: stays at `Todo` (per
   `CLAUDE.md` hygiene rules).
4. Investigate the trace before changing the test. **A failing test
   against shipped code is most likely a real product bug, not a flaky
   test.** Only modify the test if you can prove from the source that
   the assertion is wrong.

## Caveats and known limits

- **Sequential by design.** All tests share one DB; running parallel
  would cause flake. `workers: 1` in `playwright.config.ts`.
- **Don't point at production Clerk.** The setup script creates and
  modifies users; only point at a Clerk test instance.
- **First run hits the Anthropic API.** Subsequent runs are offline
  until prompts change.
- **No CI integration yet.** Once the suite is stable across two clean
  local runs, wire into GitHub Actions.
