# STATE.md — what's now

**Last updated:** 2026-04-27 — Sprint 7 closed (refreshed at end of session — keep it that way)

This file is the cheap context file. Open it at the start of a session and you skip 5–10 minutes of "what was I doing." Two paragraphs, bullets, no essays. If a section gets long, summarize and link out.

> Need the system map instead? See [`docs/architecture.md`](docs/architecture.md) — domain graph, PHI fence, user journeys.

## Current focus

**Sprint 7 closed.** All eight Phase-1 hardening tickets (#192, #222, #227, #238, #247, #269, #270, #330) shipped. The de-id pipeline that was blocking #247 now has [ADR 0002](docs/adr/0002-deidentification-strategy.md) — regex now, AWS Comprehend Medical post-BAA. Codebase substrate is meaningfully tighter than 24 hours ago.

**Open epic:** [FND-040 — codebase-maintainability foundation](https://github.com/DobbsBoldry/homeless/issues/338). Two sub-tasks remain: **040b** (per-domain `index.ts` + tighter boundary lint, **medium risk** — deserves a focused session), **040e** (migration rename pass, low-risk script-driven cleanup).

**Other remaining:** #12 OPRT-002 MOU registry (net-new, not previously sized) — schema + admin-only CRUD when partnerships need it.

## Just shipped (most recent first)

- **#349** — ESUC-247 real de-id pipeline + [ADR 0002](docs/adr/0002-deidentification-strategy.md). Belt + suspenders (ingest + prompt-build), 16 leak-vector eval, regex-now-AWS-later strategy.
- **#348** — INDC-269 Twilio webhook hygiene (repeated form-keys, C0 strip in TwiML, `INDC_SMS_HASH_PHONES` feature flag).
- **#347** — INDC-270 rate-limit deployment matrix + Vercel runtime warning.
- **#346** — OPRT-330 `/outcomes` 500 — Date params in raw `sql` templates (real bug, not stale test).
- **#344** — FND-040c [`docs/architecture.md`](docs/architecture.md) — one-page system map with domain graph, PHI fence, and three Phase-1 sequence diagrams.
- **#342** — FND-040d `STATE.md` (this file).
- **#340** — FND-040a per-domain `CLAUDE.md` × 8 (auto-load context per subdir).
- **#337** — EVDT-238 latest-outcome-wins for default-judgment + favorable rates.
- **#336** — FND-222 auth-gate unit tests (`requireRole`, `requireKlaAttorney`); first `vi.mock` usage.
- **#335** — FND-003b email is case-insensitive (Postgres `citext`).
- **#334** — EVDT-227 trigger to auto-bump `eviction_response_packets.updated_at`.
- **#333** — FND-020 domain-boundary lint + [ADR 0001](docs/adr/0001-modular-monolith.md).

## Next pickup

| # | Pts | What | Notes |
|---|---|---|---|
| 040b | 3 | per-domain `index.ts` + tighter boundary lint | Medium risk; touches every cross-domain import. Worth a focused session. |
| 040e | 1 | migration rename pass | Script-driven; rename auto-named migrations to `NNNN_STORYID_descr.sql`. |
| 12 | ? | OPRT-002 MOU registry | Net-new (not zombie) — schema + admin-only CRUD. Pull when partnerships need it. |
| Phase 2 | many | Open Phase-2 stories per project board | After FND-040 closes; coordinate with strategy doc on which epic ships next. |

## Known quirks (check here first)

- **Drizzle 0.45 + citext** — `customType` for citext produces a spurious `"undefined"."citext"` diff on every `db:generate`. Workaround: keep schema typed as `text`, enforce via DB migration, smoke-test the column type. See `src/db/schema/users.ts` comment.
- **`gh project item-list --limit N`** — silently caps at 100 regardless of N. Don't trust it for issue numbers > #100. `scripts/set-card-status.py` already routes around this via direct GraphQL.
- **`pnpm db:generate`** — runs against `DATABASE_URL` and *will* generate spurious migrations if the live DB has anything (citext, triggers, etc.) the schema-side doesn't model. Always read the generated SQL before committing it.
- **Migrations naming** — Drizzle auto-names like `0029_thick_lenny_balinger.sql` are forensically dead. Going forward, rename to `NNNN_STORYID_short_description.sql` (see 0008, 0032, 0033 for the pattern). FND-040e will do a sweep.
- **BACKLOG.md is historical** — banner at top says so. Don't try to plan against it. GitHub issues + project board are reality.
- **PHI fence (CLAUDE.md)** — no real PHI in DB or AI prompts pre-BAA. Synthetic-only for `cwt`/`esuc`. ESUC-002 lifts the fence; the de-id pipeline ([ADR 0002](docs/adr/0002-deidentification-strategy.md)) shipped — engine swap to AWS Comprehend Medical is one-day work when BAA closes.
- **Date params in raw Drizzle `sql` templates** — pass `.toISOString()`, not the `Date` directly. `postgres-js` v3.4 throws `TypeError: ... Received an instance of Date` otherwise. The typed query builder (`gte(col, dateValue)`) handles coercion correctly; only raw `sql` is affected. See [#346](https://github.com/DobbsBoldry/homeless/pull/346) and the docstring atop `src/db/queries/public-outcomes.ts`.
- **Rate-limit broken on Vercel** — in-memory token bucket is no-op on serverless. Module logs a warning at load time if `VERCEL=1`. Don't promote to Vercel without the Redis swap. Deployment matrix in `src/lib/dtrs/rate-limit.ts` docstring.

## How to refresh this file

Three minutes at end of session:
1. Move "current focus" if direction shifted
2. Move newly-merged PRs from "next pickup" → "just shipped"
3. Add anything that bit you to "known quirks" (one line; if it's complex, link to a docs page)
4. Bump the date stamp at top

Do not let this file rot. It's only useful if it reflects reality.
