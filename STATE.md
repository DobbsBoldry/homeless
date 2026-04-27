# STATE.md — what's now

**Last updated:** 2026-04-27 (refreshed at end of session — keep it that way)

This file is the cheap context file. Open it at the start of a session and you skip 5–10 minutes of "what was I doing." Two paragraphs, bullets, no essays. If a section gets long, summarize and link out.

> Need the system map instead? See [`docs/architecture.md`](docs/architecture.md) — domain graph, PHI fence, user journeys.

## Current focus

**Sprint 7 — Phase-1 hardening + maintainability foundation.** Cleaning up follow-ups and tightening the codebase substrate before pushing into the de-id pipeline (#247) and Phase 2.

Active epic: [FND-040 — codebase-maintainability foundation](https://github.com/DobbsBoldry/homeless/issues/338). Three sub-tasks remain: 040b (per-domain `index.ts` + tighter boundary lint, **medium risk**), 040c (`docs/architecture.md`), 040e (migration rename pass).

## Just shipped (most recent first)

- **#340** — FND-040a per-domain `CLAUDE.md` × 8 (auto-load context per subdir).
- **#337** — EVDT-238 latest-outcome-wins for default-judgment + favorable rates (single CTE, no double-counting).
- **#336** — FND-222 auth-gate unit tests (`requireRole`, `requireKlaAttorney`); first `vi.mock` usage.
- **#335** — FND-003b email is case-insensitive (Postgres `citext`); smoke test asserts column type so a regression fails loudly.
- **#334** — EVDT-227 trigger to auto-bump `eviction_response_packets.updated_at`.
- **#333** — FND-020 domain-boundary lint + [ADR 0001](docs/adr/0001-modular-monolith.md) (modular monolith over microservices).

## Next pickup — Sprint 7 remaining

| # | Pts | What | Notes |
|---|---|---|---|
| 247 | 5 | ESUC real de-id pipeline | **Strategic.** Worth a design checkpoint before diving in — what's the recall target, regex vs NER, scope. |
| 269 | ~3 | INDC Twilio webhook hygiene | Multi-value params, control-char strip, phone hashing. |
| 270 | ~2 | INDC rate-limit persistence (survives Railway restarts) | Currently in-memory; restart blows the bucket. |
| 330 | ~3 | OPRT J5 admin e2e bug | **Triage first** — real bug or stale test? |
| 12 | ? | OPRT-002 MOU registry | Net-new (not zombie) — schema + admin-only CRUD. |
| 040b | 3 | per-domain `index.ts` + tighter boundary lint | Medium risk; touches every cross-domain import. |
| 040c | 2 | `docs/architecture.md` | Pure docs; needs decision on diagram shape. |
| 040e | 1 | migration rename pass | Script-driven; rename auto-named migrations. |

## Known quirks (check here first)

- **Drizzle 0.45 + citext** — `customType` for citext produces a spurious `"undefined"."citext"` diff on every `db:generate`. Workaround: keep schema typed as `text`, enforce via DB migration, smoke-test the column type. See `src/db/schema/users.ts` comment.
- **`gh project item-list --limit N`** — silently caps at 100 regardless of N. Don't trust it for issue numbers > #100. `scripts/set-card-status.py` already routes around this via direct GraphQL.
- **`pnpm db:generate`** — runs against `DATABASE_URL` and *will* generate spurious migrations if the live DB has anything (citext, triggers, etc.) the schema-side doesn't model. Always read the generated SQL before committing it.
- **Migrations naming** — Drizzle auto-names like `0029_thick_lenny_balinger.sql` are forensically dead. Going forward, rename to `NNNN_STORYID_short_description.sql` (see 0008, 0032, 0033 for the pattern). FND-040e will do a sweep.
- **BACKLOG.md is historical** — banner at top says so. Don't try to plan against it. GitHub issues + project board are reality.
- **PHI fence (CLAUDE.md)** — no real PHI in DB or AI prompts pre-BAA. Synthetic-only for `cwt`/`esuc`. ESUC-002 lifts the fence; the de-id pipeline (#247) is the unblocker.

## How to refresh this file

Three minutes at end of session:
1. Move "current focus" if direction shifted
2. Move newly-merged PRs from "next pickup" → "just shipped"
3. Add anything that bit you to "known quirks" (one line; if it's complex, link to a docs page)
4. Bump the date stamp at top

Do not let this file rot. It's only useful if it reflects reality.
