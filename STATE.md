# STATE.md — what's now

**Last updated:** 2026-05-04 — Sprint 12 closed (SUBP-005 #377 merged); Sprint 13 active (Veterans + handoff + funder visibility)

This file is the cheap context file. Open it at the start of a session and you skip 5–10 minutes of "what was I doing." Two paragraphs, bullets, no essays. If a section gets long, summarize and link out.

> Need the system map instead? See [`docs/architecture.md`](docs/architecture.md) — domain graph, PHI fence, user journeys.

## Current focus

**Sprint 12 closed (~23 pts shipped).** DTRS-013 KY DOC ([#376](https://github.com/DobbsBoldry/homeless/pull/376) / [ADR 0009](docs/adr/0009-ky-doc-data-sharing.md)), SUBP-005 reentry pathway ([#377](https://github.com/DobbsBoldry/homeless/pull/377)), plus PRVN-001 ED first-time-homeless flag ([#373](https://github.com/DobbsBoldry/homeless/pull/373)) and PRVN-006 outreach pre-positioning ([#374](https://github.com/DobbsBoldry/homeless/pull/374)) pulled forward from S13 candidates. SUBP epic now 5 of 7 pathways shipped. **COOR-012 (5pt) and INDC-019 (2pt) deferred** to S13.

**Sprint 13 — "Veterans + handoff + funder visibility."** Rounds out the SUBP epic with HUD-VASH, closes the carryover handoff loop, and gives funders/coalition leadership their first demand-side visibility.

| # | Pts | Story |
|---|---|---|
| [#120](https://github.com/DobbsBoldry/homeless/issues/120) COOR-012 | 5 | Inter-agency handoff workflow — **carryover from S12; do first** |
| [#135](https://github.com/DobbsBoldry/homeless/issues/135) SUBP-006 | 8 | Veteran pathway (HUD-VASH; VFW Owensboro) — reuses agreement→pathway pattern |
| [#147](https://github.com/DobbsBoldry/homeless/issues/147) OPRT-007 | 5 | Funder-portal generator (per-funder views into outcomes) |
| [#121](https://github.com/DobbsBoldry/homeless/issues/121) COOR-013 | 5 | 7-14 day demand forecasting per shelter |
| **stretch** [#252](https://github.com/DobbsBoldry/homeless/issues/252) INDC-019 | 2 | Preserve grant history on consent re-grant (carryover) |

**Sprint goal:** Veterans pathway ships using the validated agreement template; coalition leadership and funders get their first dedicated views.

**Sequencing:** COOR-012 first (clears S12 slip). SUBP-006 starts in parallel — spike VA/HUD-VASH agreement template fit before committing the full 8 (split out as DTRS-015 if it diverges from KY DOC/OASIS shape). OPRT-007 + COOR-013 independent; either order. INDC-019 only if rest finishes early.

**Sprint 13 dates:** 2026-05-05 → 2026-05-18. Mid-sprint check 2026-05-11.

## Just shipped (most recent first)

- **#377** — SUBP-005 reentry pathway: 60-day pre-release window automation, KY DOC gate, window sweep. Validates agreement→pathway pattern (template for SUBP-006 Veterans).
- **#376** — DTRS-013 KY DOC reentry data-sharing workflow + [ADR 0009](docs/adr/0009-ky-doc-data-sharing.md). Third instance of the per-partner agreement pattern (after DCBS, OASIS).
- **#375** — Nav: expose 8 orphaned routes + agreements hub.
- **#374** — PRVN-006 outreach pre-positioning priorities (ZIP-aggregate). Pulled forward from S13 candidate slate.
- **#373** — PRVN-001 ED first-time-homeless flag + alert view. Pulled forward from S13 candidate slate.
- **#372** — SUBP-007 families w/ children pathway + school-stability engine.
- **#371** — SUBP-004 DV survivor pathway + abuser-blind middleware ([ADR 0008](docs/adr/0008-abuser-blind-middleware.md)). Structural separation of survivor records from abuser-accessible queries.
- **#370** — DTRS-012 OASIS data-sharing agreement workflow + [ADR 0007](docs/adr/0007-oasis-data-sharing.md). Generic per-partner agreement template; KY DOC will reuse this as DTRS-013 in Sprint 12.
- **#368** — OPRT-002 MOU admin UI + generic agreement expiration watcher (Inngest). One watcher serves DCBS, OASIS, KY DOC, faith MOUs alike.
- **#367** — SUBP-002 TEAMKY Former Foster Youth Medicaid extension automation.
- **#366** — SUBP-001 foster aging-out countdown engine + caseworker surface.
- **#365** — pin pnpm to 9.15.9 via railpack.json (Railway deploy fix).
- **#364** — DTRS-011 DCBS data-sharing agreement workflow + [ADR 0006](docs/adr/0006-dcbs-data-sharing.md). The pattern that DTRS-012/013 inherit from.
- **#363** — PRVN-004 school liaison aggregate insights (connection rate, status distribution, time-to-connect).
- **#362** — COOR-014 closed-loop referral confirmation (liaison sees what happened to the referral).
- **#361** — PRVN-003 McKinney-Vento school referral receiver (FERPA fork).
- **#359** — DTRS-010 FERPA-compliant partner-agreements registry + intake.
- **#358** — ADR 0004 + ADR 0005 schools-entry architectural spike.
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

## Next pickup (Sprint 13 — "Veterans + handoff + funder visibility")

| # | Pts | What | Notes |
|---|---|---|---|
| [#120](https://github.com/DobbsBoldry/homeless/issues/120) COOR-012 | 5 | Inter-agency handoff workflow | Carryover from S12. Consent-gated context transfer. **Do FIRST** — clears the slip. |
| [#135](https://github.com/DobbsBoldry/homeless/issues/135) SUBP-006 | 8 | Veteran pathway (HUD-VASH; VFW Owensboro) | Reuses agreement→pathway pattern. Spike VA agreement template fit before committing — split as DTRS-015 if it diverges. |
| [#147](https://github.com/DobbsBoldry/homeless/issues/147) OPRT-007 | 5 | Funder-portal generator | Per-funder views into outcomes. Scope tightly: one funder, one report template, no auth-tenancy redesign. |
| [#121](https://github.com/DobbsBoldry/homeless/issues/121) COOR-013 | 5 | 7-14 day demand forecasting per shelter | Coalition leadership visibility; pairs with OPRT-007. |
| **stretch** [#252](https://github.com/DobbsBoldry/homeless/issues/252) INDC-019 | 2 | Preserve grant history on consent re-grant | Only if rest finishes early. |

**Sprint 14+ candidate threads** (not yet committed):
- "Prevention edge wrap-up": PRVN-005 (utility shutoff heat-map, 8) + PRVN-007 (macro demand forecasting, 8) + PRVN-002 (school attendance signal, 13)
- "Coalition operational depth": COOR-009 (all 6 shelters integrated, 5) + COOR-010 (donation matching, 5) + COOR-011 (volunteer skill matching, 8)
- "INDC client-facing": INDC-020 (companion home screen, 5) + INDC-013 (benefits screening, 5) + INDC-015 (mood check-in, 5)

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
