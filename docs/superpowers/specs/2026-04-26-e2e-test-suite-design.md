# e2e Test Suite — Design

**Date:** 2026-04-26 · **Author:** Bo + Claude · **Status:** Approved, ready for plan

## Problem

The platform has ~60 merged feature PRs across 6 sprints (EVDT, ESUC, CWT, COOR, INDC, OPRT, DTRS, COAL) with ~50 routes shipped. Coverage to date is unit tests on `src/lib/**` only — there is no integration or end-to-end test that exercises the rendered UI, the auth-gated routing, or the cross-story seams (consent gates, role-aware nav, DV-blind redaction, audit-log invariants). As stories accumulate, regressions in one epic increasingly surface as silent failures in another.

## Goal

Stand up an e2e suite that:

1. Catches regressions in the workflows real users (KLA attorneys, OH care coordinators, caseworkers, 211 dispatchers, coalition admins) actually run.
2. Protects the cross-story invariants that any one ticket would be unlikely to test on its own.
3. When tests fail, generates a triageable bug ticket on the project board with enough context to act on.

Non-goal: validating AI output quality. e2e checks plumbing (when the AI returns X, the UI does Y). AI quality belongs in the eval layer.

## Approach

Hybrid: persona-journey tests as the spine, plus targeted smoke tests at risky cross-story seams.

### Stack

- **Playwright** (TypeScript) — Next.js 15 support, parallel by default, traces and videos on failure.
- **Tests location:** `e2e/` at repo root, sibling of `src/`. Subfolders: `e2e/journeys/`, `e2e/smoke/`, `e2e/fixtures/`, `e2e/.cache/`, `e2e/.traces/`.
- **Single Playwright config** targeting `http://localhost:3000`. Playwright's `webServer` boots `pnpm dev` against the e2e database.

### Local environment

The suite owns its own Postgres in Docker — no entanglement with the developer's local DB.

- `e2e/docker-compose.yml`: single `postgres:16-alpine` on port `5433` (chosen to avoid collision), ephemeral named volume.
- `scripts/e2e-setup.mts`:
  1. Verify required env keys present in `.env.e2e` (`DATABASE_URL`, `CLERK_*`, `ANTHROPIC_API_KEY`); fail with explicit list of what's missing.
  2. `docker compose up -d` and wait for `pg_isready`.
  3. `drizzle-kit push` against the e2e DB (no migration history; the suite gets the current schema every time).
  4. Run the existing demo seed (PR #233) into the e2e DB.
  5. Provision Clerk test users for each role using Clerk's `testingTokens` flow (no real email round-trip).
- `pnpm e2e`: setup → start dev → run Playwright → `docker compose down -v`.
- `.env.e2e` is gitignored. `.env.e2e.example` is committed with all required keys and placeholder values.

### Auth fixture

Playwright `storageState` per role, generated once at suite start:

- `attorney@e2e.test` (KLA partner, role `attorney`)
- `coordinator@e2e.test` (OH partner, role `care_coordinator`)
- `caseworker@e2e.test` (Catholic Charities partner, role `caseworker`)
- `dispatcher@e2e.test` (211 partner, role `dispatcher`)
- `admin@e2e.test` (coalition staff, role `superadmin`)

Each test declares its persona and Playwright loads the matching `storageState`.

### Outbound interception — single instrumentation hook

There is no central `src/ai/client.ts` today (every consumer imports `@anthropic-ai/sdk` directly), and Resend/Twilio sends happen across many helpers. Rather than refactor a dozen consumers, all interception lives in one place: a server-startup hook in `instrumentation.ts`.

When `E2E_MOCK_OUTBOUND=1`:

- The hook installs a global `fetch` wrapper that inspects the request URL.
- **`api.anthropic.com`** requests: response cached to `e2e/.cache/ai/<hash>.json`. Cache key is SHA-256 of the request body. First local run records; subsequent runs replay. When a prompt changes, hash changes, cache misses, call is re-recorded. The wrapper also rewrites the request body to force `model: "claude-haiku-4-5"` before hashing, so e2e never hits Sonnet/Opus.
- **`api.twilio.com`** and **`api.resend.com`** requests: payload written to `outbound_messages_test` (a new Drizzle table: `kind`, `to`, `body`, `created_at`); the wrapper returns a synthetic success response so consuming code is unaffected.
- All other URLs pass through untouched.

Cache directory is gitignored locally; committed in CI so CI never hits the API. Production code paths are entirely unchanged — when the env var is unset, the hook is a no-op.

## Test inventory

### Persona journeys (5 tests, the spine)

Each ~6-12 steps, target ≤60s per journey. Each journey covers many tickets — the cross-references below are illustrative, not exhaustive.

**J1 — KLA attorney morning** (`e2e/journeys/kla-attorney.spec.ts`)
Sign in → docket dashboard → open highest-risk filing → "Ask Claude about this case" → generate outreach letter → export packet PDF → mark case status `responded`.
Covers: EVDT-009, EVDT-012, EVDT-013, EVDT-015, EVDT-016, EVDT-017, EVDT-021, plus PRs #285 / #287.

**J2 — OH care coordinator morning** (`e2e/journeys/oh-coordinator.spec.ts`)
Sign in → ED morning triage → super-utilizer queue → patient detail → batch care-plan draft → refer to caseworker queue.
Covers: ESUC-008, ESUC-009, ESUC-011, plus PRs #294, #297, #298, #300.

**J3 — Caseworker** (`e2e/journeys/caseworker.spec.ts`)
Sign in → morning triage → person view → AI pre-meeting briefing → benefits screener → record post-meeting note → upload doc and verify AI extraction populated structured fields.
Covers: CWT-006, CWT-007, CWT-011, CWT-012, CWT-021, plus PRs #295, #296, #302.

**J4 — 211 dispatcher SMS round-trip** (`e2e/journeys/dispatcher-sms.spec.ts`)
POST a Twilio-signed request to `/api/sms` with body `BED FAMILY` from a synthetic number → assert reply text and `outbound_messages_test` row → dispatcher dashboard reflects the lookup.
Covers: COOR-006, INDC-001, INDC-002, INDC-003, plus PR #307.

**J5 — Coalition admin** (`e2e/journeys/coalition-admin.spec.ts`)
Sign in → publish app-wide comms banner → transparency report page → trigger AI quarterly narrative → fiscal court brief PDF download asserts non-empty PDF.
Covers: OPRT-006, OPRT-008, OPRT-010, DTRS-013, plus PRs #279, #280, #303.

### Targeted smoke tests (6 tests, the seams)

**S1 — Consent gate** (`e2e/smoke/consent-gate.spec.ts`)
Caseworker views person without consent → assertions on redacted fields. Submit consent grant via `/p/[ref]/consent/grant` → re-fetch person view → assertions on full data.
Protects: DTRS-001, DTRS-002, plus PR #272.

**S2 — DV-blind redaction** (`e2e/smoke/dv-blind.spec.ts`)
Person flagged `dv_flag=true` is queried across CWT person view, ESUC patient view, and COOR bed-hold UI. None of them surface a location field.
Protects: DTRS-004, plus issues #268 / #273.

**S3 — Audit log append-only** (`e2e/smoke/audit-log.spec.ts`)
Direct DB connection (using the test container) attempts UPDATE and DELETE on `audit_log`. Both must error.
Protects: issue #198, PR #228.

**S4 — Role-based access** (`e2e/smoke/role-access.spec.ts`)
For each role, assert nav menu contains only permitted entries. For each role, hit one forbidden route directly and assert 404 or 403.
Protects: FND-010.

**S5 — Twilio webhook signature** (`e2e/smoke/twilio-signature.spec.ts`)
POST to `/api/sms` without a valid `X-Twilio-Signature` header → assert 403. POST with valid signature → assert 200.
Protects: INDC-001.

**S6 — Bed-hold expiration** (`e2e/smoke/bed-hold-expiration.spec.ts`)
Create a 90-minute hold → directly age the row in DB to 91 minutes → trigger the Inngest cron via `/api/inngest/test/run` (test-mode endpoint to be added if not present) → assert hold row marked released.
Protects: COOR-005.

### Coverage explicitly out of scope

- Hub-page placeholders (#271 is intentionally empty UI).
- Admin user-management edge cases beyond promote-to-attorney smoke.
- `/p/[ref]/consent` token edge cases beyond S1.
- Visual regression and screenshot diffs.
- AI output quality assertions.

## Bug-filing workflow

On Playwright failure, the runner does **not** auto-file. We triage first.

`pnpm e2e:report` reads the most recent Playwright JSON report and, for each failed test, drafts a `gh issue create` invocation:

- **Title:** `[e2e] <test id> — <name of the step that failed>`. Test ids are short (`J1`, `S2`, etc.) declared in each spec file.
- **Labels:** `bug`, `e2e`, plus the epic label inferred from the spec file path (`journeys/kla-attorney.spec.ts` → `epic:evdt`).
- **Body:** failing assertion, last 5 console logs from the page, link to the Playwright trace artifact in `e2e/.traces/<test>/`, and the spec file:line.
- **Project board:** leaves at `Todo`, unassigned. Per `CLAUDE.md` hygiene rules.

The `pnpm e2e:report` script prompts before each `gh` call so noisy first runs don't spam the board. Once the suite is stable (two clean runs in a row), we can add a `--yes` flag for unattended use.

## Architectural changes outside the e2e/ tree

Three small changes land in the application code as part of this work:

1. **`E2E_MOCK_OUTBOUND` flag** in the Resend send helper and the Twilio outbound helper.
2. **`outbound_messages_test` table** — new Drizzle schema file.
3. **AI cache wrapper** — `src/ai/client.ts` gains an `E2E_AI_CACHE` branch that reads/writes `e2e/.cache/ai/<hash>.json` and forces `claude-haiku-4-5`. The branch is dead code in production (env var unset).

No production behavior changes.

## Files added

```
e2e/
  docker-compose.yml
  playwright.config.ts
  fixtures/
    auth.ts                   # storageState provisioning per role
    db.ts                     # direct DB connection for S3, S6 setup
    ai-cache.ts               # if cache logic isn't fully in src/ai/
  journeys/
    kla-attorney.spec.ts
    oh-coordinator.spec.ts
    caseworker.spec.ts
    dispatcher-sms.spec.ts
    coalition-admin.spec.ts
  smoke/
    consent-gate.spec.ts
    dv-blind.spec.ts
    audit-log.spec.ts
    role-access.spec.ts
    twilio-signature.spec.ts
    bed-hold-expiration.spec.ts
  README.md                   # how to run, how to add a test
.env.e2e.example
scripts/
  e2e-setup.mts
  e2e-report.mts              # the gh-issue drafter
```

`package.json` gains: `e2e`, `e2e:setup`, `e2e:report` scripts and Playwright + `@playwright/test` devDependencies.

## Open risks

- **Clerk testingTokens flow** is documented but I haven't verified it works against our Clerk app version. If it doesn't, fallback is API-key-based session minting via `@clerk/backend`. Either way the persona fixture isolates this concern.
- **Cache-committed-in-CI** approach assumes prompts don't change in PRs that don't intend to. If a PR inadvertently changes a prompt, cache misses and CI fails the e2e step. That's the correct behavior — surfaces unintended prompt drift — but it'll be confusing the first time. Document in `e2e/README.md`.
- **The Inngest test-mode endpoint for S6** may not exist yet. If not, S6 ships in a follow-up PR with a trivial test-only route handler that calls the cron's handler directly. Sized into the plan.

## Definition of done

- `pnpm e2e` runs cleanly twice in a row from a fresh checkout.
- 11 tests in the suite (5 journeys + 6 smoke).
- Each test produces a Playwright trace on failure.
- `pnpm e2e:report` correctly drafts a `gh issue` invocation for each failure.
- `e2e/README.md` documents how to add a test, how to refresh the AI cache, how to run a single spec, and the `E2E_MOCK_OUTBOUND` flag.
- One full pass executed locally; any genuine failures filed as bugs on the project board.
