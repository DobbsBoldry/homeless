# STATE.md — what's now

**Last updated:** 2026-04-27 — Sprint 8 closed (faith-based opt-in foundation shipped)

This file is the cheap context file. Open it at the start of a session and you skip 5–10 minutes of "what was I doing." Two paragraphs, bullets, no essays. If a section gets long, summarize and link out.

> Need the system map instead? See [`docs/architecture.md`](docs/architecture.md) — domain graph, PHI fence, user journeys.

## Current focus

**Sprint 8 closed — faith-based opt-in foundation.** All three DTRS stories shipped: schema + privacy contract (#354 / [ADR 0003](docs/adr/0003-faith-aggregate-privacy-contract.md)), Catholic Charities admin intake form (#355), per-ministry coordination signals read view + queries (#356). The platform can now receive aggregate-only data from faith partners without ever modeling individual records — privacy by structural impossibility, not just policy. Phase 3 reverse-channel (signals back to ministries) explicitly deferred per the strategy doc.

This was the first sprint built using the [`superpowers:subagent-driven-development`](https://github.com/jasonkneen/superpowers) skill — implementer subagent + spec-compliance reviewer + code-quality reviewer per ticket. Spec reviewer caught a hardcoded `suppressedCount=0` on DTRS-008; quality reviewer caught a typo + error-leak + a11y miss on DTRS-008, and partial-coverage signaling + window-boundary exclusion on DTRS-009. All resolved before merge.

**Sprint 9 candidate** (per `product-vision/roadmap.html` "What ships in Phase 2"): schools integration. [#125 PRVN-003](https://github.com/DobbsBoldry/homeless/issues/125) (McKinney-Vento liaison referral receiver, 5pt) + [#126 PRVN-004](https://github.com/DobbsBoldry/homeless/issues/126) (closed-loop reporting school↔coalition, 5pt) + [#140 DTRS-010](https://github.com/DobbsBoldry/homeless/issues/140) (FERPA-compliant school data agreement template, 5pt). 15pt total. Faith partnerships now have receiving infrastructure; schools are the next entry per the strategy doc's sequence.

**Other open work:** [#12 OPRT-002 MOU registry](https://github.com/DobbsBoldry/homeless/issues/12) (net-new, unsized) — every faith ministry will eventually need an MOU; ship this when partnerships need it.

**Sync items to address:** ESUC-001/002 closed as `NOT_PLANNED` on 2026-04-27 (project-board cleanup) — but the PHI fence is still real. Either reopen them or update CLAUDE.md/ADR-0002 to reflect that the BAA actually closed. Bo's call — flagged but not yet acted on.

## Just shipped (most recent first)

- **#356** — DTRS-009 per-ministry coordination signals (admin read view + queries). Seven privacy-respecting reads + two pure aggregator helpers. `compareMinistryWindows` carries a `partial` flag so all-suppressed windows don't get misread as "trending down." Overlap window semantics so monthly submissions aren't dropped by trailing 28-day filters.
- **#355** — DTRS-008 Catholic Charities aggregate intake form. Admin-gated form with live cell-size suppression preview + audit-logged submit. Catholic Charities of the Diocese of Owensboro seeded as the first opted-in ministry.
- **#354** — DTRS-007 faith-aggregate schema + cell-size suppression + [ADR 0003](docs/adr/0003-faith-aggregate-privacy-contract.md). Four tables, no individual-record column anywhere — privacy by structural impossibility.
- **#352** — FND-040b per-domain `index.ts` barrels + barrel-only boundary lint. 60+ consumers migrated to `@/lib/{domain}` barrel imports. `'use client'` files exempt (deep imports OK there — barrels would drag postgres into the browser bundle). [ADR 0001](docs/adr/0001-modular-monolith.md) amended.
- **#351** — FND-040e migration rename pass. 30 auto-named migrations → `NNNN_STORYID_descr.sql`. Also dropped a stale `0034_windy_sir_ram` journal orphan that would have failed `pnpm db:migrate` on any fresh environment.
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
| [#125](https://github.com/DobbsBoldry/homeless/issues/125) PRVN-003 | 5 | McKinney-Vento liaison referral receiver | Sprint 9 candidate (schools entry per roadmap.html). |
| [#126](https://github.com/DobbsBoldry/homeless/issues/126) PRVN-004 | 5 | Closed-loop reporting school↔coalition | Sprint 9 candidate; pairs with PRVN-003. |
| [#140](https://github.com/DobbsBoldry/homeless/issues/140) DTRS-010 | 5 | FERPA-compliant school data agreement template + intake | Sprint 9 candidate; receiving-infra equivalent of DTRS-008 for schools. |
| [#12](https://github.com/DobbsBoldry/homeless/issues/12) OPRT-002 | ? | MOU registry | Net-new, unsized; ship when partnerships need MOU tracking. |
| Sprint 10+ | many | DCBS / foster aging-out (SUBP-001/002/003 + DTRS-011) | Per roadmap.html sequence after schools. |

## Known quirks (check here first)

- **Drizzle 0.45 + citext** — `customType` for citext produces a spurious `"undefined"."citext"` diff on every `db:generate`. Workaround: keep schema typed as `text`, enforce via DB migration, smoke-test the column type. See `src/db/schema/users.ts` comment.
- **`gh project item-list --limit N`** — silently caps at 100 regardless of N. Don't trust it for issue numbers > #100. `scripts/set-card-status.py` already routes around this via direct GraphQL.
- **`pnpm db:generate`** — runs against `DATABASE_URL` and *will* generate spurious migrations if the live DB has anything (citext, triggers, etc.) the schema-side doesn't model. Always read the generated SQL before committing it.
- **Migrations naming** — Drizzle auto-names like `0029_thick_lenny_balinger.sql` are forensically dead. Going forward, rename to `NNNN_STORYID_short_description.sql` (FND-040e swept the historical backlog; see 0029_CWT-019_voice_intake.sql, 0033_users_email_citext.sql for examples). When `db:generate` produces a new auto-named migration, rename it before commit and update the `tag` field in `drizzle/migrations/meta/_journal.json` to match — drizzle keys applied-status by SHA-256 of SQL content, so renames are safe as long as content is preserved.
- **BACKLOG.md is historical** — banner at top says so. Don't try to plan against it. GitHub issues + project board are reality.
- **PHI fence (CLAUDE.md)** — no real PHI in DB or AI prompts pre-BAA. Synthetic-only for `cwt`/`esuc`. ESUC-002 lifts the fence; the de-id pipeline ([ADR 0002](docs/adr/0002-deidentification-strategy.md)) shipped — engine swap to AWS Comprehend Medical is one-day work when BAA closes.
- **Date params in raw Drizzle `sql` templates** — pass `.toISOString()`, not the `Date` directly. `postgres-js` v3.4 throws `TypeError: ... Received an instance of Date` otherwise. The typed query builder (`gte(col, dateValue)`) handles coercion correctly; only raw `sql` is affected. See [#346](https://github.com/DobbsBoldry/homeless/pull/346) and the docstring atop `src/db/queries/public-outcomes.ts`.
- **Rate-limit broken on Vercel** — in-memory token bucket is no-op on serverless. Module logs a warning at load time if `VERCEL=1`. Don't promote to Vercel without the Redis swap. Deployment matrix in `src/lib/dtrs/rate-limit.ts` docstring.
- **Barrels (`export *`) are incompatible with `'use client'`** — `src/lib/{domain}/index.ts` aggregates server-only code (postgres, AI clients, audit glue) that Next.js can't tree-shake out of the browser bundle. Build fails with `Module not found: Can't resolve 'tls' / 'perf_hooks'`. Client components must use deep imports (e.g. `from '@/lib/cwt/triage'`, not `from '@/lib/cwt'`). The boundary lint exempts files starting with `'use client'`. Unit tests + typecheck + biome all pass with the broken setup — only e2e (`pnpm e2e`) catches it. See [#352](https://github.com/DobbsBoldry/homeless/pull/352#issuecomment-4331515841) and [ADR 0001](docs/adr/0001-modular-monolith.md) Amendment 2026-04-27.
- **Next.js `'use server'` × vitest** — modules with `'use server'` get transformed at build time so all exports become server-action stubs that can't be called synchronously from a vitest test. To unit-test FormData parsing or other action helpers, extract pure logic to a sibling file (no `'use server'`) and have the action import + call it. See [`src/app/actions/faith-aggregate-parse.ts`](src/app/actions/faith-aggregate-parse.ts) for the pattern (DTRS-008).
- **Faith-aggregate privacy contract** ([ADR 0003](docs/adr/0003-faith-aggregate-privacy-contract.md)) — never coerce a suppressed cell to zero in any read query, never reverse-engineer a suppressed value from sums-vs-breakouts. The DB CHECK constraint guarantees `(value NULL ↔ suppressed=true)` — read paths must propagate that, not collapse it. Use `partial: true` flags or `suppressedMinistries` counts to surface partial coverage instead.

## How to refresh this file

Three minutes at end of session:
1. Move "current focus" if direction shifted
2. Move newly-merged PRs from "next pickup" → "just shipped"
3. Add anything that bit you to "known quirks" (one line; if it's complex, link to a docs page)
4. Bump the date stamp at top

Do not let this file rot. It's only useful if it reflects reality.
