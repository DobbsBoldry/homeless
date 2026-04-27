# ADR 0001 — Modular monolith over microservices

**Status:** Accepted — 2026-04-26
**Driver:** Bo (solo dev). Question raised in Sprint 7 planning: "do we need microservices to make this maintainable as it grows?"

## Context

Six sprints in (~50 PRs, six product domains: EVDT, ESUC, CWT, COAL, INDC, OPRT). The codebase is one Next.js 15 app on Vercel/Railway. We're a one-developer team with a HIPAA migration ahead of us (ESUC-002, post-BAA).

The instinct toward microservices is real: domain boundaries are already visible in `src/lib/{domain}/` and the schema list is getting long. But the operational cost of splitting — service deploys, inter-service auth, distributed tracing, schema-coordination across services, network failure modes — is multiplicative on a solo team. We'd buy ~10% cleaner boundaries at 5x the ops surface area. That trade-off kills velocity.

A scan of cross-domain imports today shows exactly **one** real coupling between `src/lib/{domain}/` folders:

- `indc → coordination` (6 imports, all from `@/lib/coordination/bed-availability`) — SMS bed lookups need the bed-availability data model.

That is small. The codebase is already mostly modular by accident. We should make it modular on purpose, in the same process, not split it across services.

## Decision

**Build a modular monolith.** Keep one Next.js app, one deploy, one Postgres. Enforce domain boundaries at the source level via tooling, not the network.

Three concrete moves:

### 1. Domain folders are hard boundaries

`src/lib/{domain}/` is the unit of ownership. Today's domains: `coalition`, `coordination`, `cwt`, `dtrs`, `esuc`, `eviction` (= EVDT), `indc`, `oprt`. Each owns its server-side logic, AI prompts, and types.

**Rule:** a file under `src/lib/A/` may not import from `src/lib/B/` *unless* B is on A's allow-list. The allow-list lives in `scripts/check-domain-boundaries.mts` and is intentionally short:

| Domain | May import from |
|---|---|
| `coordination` | (none) — leaf |
| `coalition` | `coordination` |
| `cwt` | `coordination`, `dtrs` |
| `dtrs` | (none) — leaf |
| `esuc` | `coordination`, `dtrs` |
| `eviction` | `dtrs` |
| `indc` | `coordination` (existing real dep — bed lookups) |
| `oprt` | `coalition`, `coordination`, `cwt`, `esuc`, `eviction`, `indc` (read-only — narrative/transparency rolls everything up) |

Cross-domain imports outside this allow-list = boundary violation = CI fail. New entries to the allow-list require an ADR amendment (one line in this file is fine — boundary changes are decisions worth recording).

`src/lib/utils.ts`, `src/lib/audit.ts`, `src/lib/auth.ts`, etc. (non-domain shared code at the top of `src/lib/`) are importable from anywhere — they're the common kernel.

### 2. Lint rule via a script, not Biome

Biome (our linter) doesn't yet support path-based import restrictions; ESLint's `no-restricted-paths` does, but adding ESLint just for this is overkill. We get equivalent enforcement from a ~50-line script:

```ts
// scripts/check-domain-boundaries.mts
const ALLOW: Record<string, string[]> = {
  coordination: [],
  coalition: ['coordination'],
  cwt: ['coordination', 'dtrs'],
  dtrs: [],
  esuc: ['coordination', 'dtrs'],
  eviction: ['dtrs'],
  indc: ['coordination'],
  oprt: ['coalition', 'coordination', 'cwt', 'esuc', 'eviction', 'indc'],
};
// walk src/lib/{domain}/**, parse `from '@/lib/X/...'`,
// fail if X not in ALLOW[domain] and X !== domain.
```

Wire it into:
- `package.json` → `"lint:boundaries": "tsx scripts/check-domain-boundaries.mts"`.
- CI (`.github/workflows/ci.yml`) — runs after `pnpm lint`, before typecheck.
- Local pre-push discipline: run alongside `pnpm exec biome check` (this repo doesn't use a husky hook; the strict-lint-before-push convention is documented in CLAUDE.md memory).

**Scope:** the lint runs only against `src/lib/{domain}/`. Server actions (`src/app/actions/*.ts`) and components (`src/components/{domain}/*`) are the *composition layer* — they're allowed to span domains, because that's their job. The boundary that matters is at the domain-logic layer, where business rules live; if `src/lib/eviction/` can't reach into `src/lib/esuc/`, the architectural property holds regardless of what an action wires up.

### 3. Postgres schema-per-domain — deferred, opt-in

Drizzle supports `pgSchema('evdt').table(...)` for namespaced tables. Migrating today's flat `public.*` to per-domain schemas (`evdt.*`, `esuc.*`, `indc.*`, `coord.*`, `cwt.*`, `coal.*`, `oprt.*`, `dtrs.*`) would be roughly a one-day migration: regenerate Drizzle schema, write a single `ALTER TABLE ... SET SCHEMA` migration, update the `src/db/schema/index.ts` re-exports.

**We're not doing this now.** Reasons:
- Zero functional benefit today; the lint rule already gives us logical isolation.
- Schema-per-domain pays off when there's an auth-on-the-DB-layer story (row-level security per domain, separate read replicas, separate backup policies). None of that is on the near roadmap.
- Touching every `src/db/schema/*.ts` and re-running CI for every story for a week is a real cost.

**Trigger to revisit:** ESUC-002 (HIPAA migration, post-BAA). At that point the PHI tables (`ed_encounters`, `esuc_care_plans`, `client_documents`, `client_intakes`, plus `dtrs.*` consent tables) want to live in a dedicated `phi` schema with its own role grants — *that's* the right moment to do the schema split, because it's compliance-driven and the migration cost is amortized against work we're already doing.

## Consequences

**What we get:**
- A boundary-violation today fails CI — same blast-radius guarantee microservices give us at the network layer, achieved at compile time, with zero ops cost.
- Domain folders are real units. `src/lib/eviction/` could be lifted into a separate package or service later with mechanical effort, because nothing outside its allow-list reaches in.
- The PHI fence (CLAUDE.md) is reinforced: `dtrs` and `esuc` are leaf-ish, hard to accidentally pull from elsewhere.

**What we don't get:**
- Independent deploys. If `indc` ships a bug, the whole app rolls back. Acceptable on a solo team.
- Independent scaling. Vercel scales the app horizontally; per-domain CPU/memory profiles can't diverge. Not a problem yet — heavy AI work is already async via Inngest (FND-009), which *is* a real isolation boundary for the workloads that need it.
- Polyglot domains. Everything stays TypeScript. Not a feature we'd want even if we could have it.

**What we should watch for as the trigger to actually split a service:**
1. **HIPAA blast radius (likely):** post-BAA, PHI handlers may want a separate VPC + separate logs + separate audit trail. Candidate: an `esuc-phi` service that owns ED encounter ingestion and care-plan AI calls. *This is the one I'd actually predict happens.*
2. **SMS pipeline scale (possible):** if `indc` Twilio volume gets to where Inngest queues + Vercel functions stop being enough, an SMS worker process is a clean carve-out — `lib/indc` already has a narrow surface and one external dep.
3. **OPRT report rendering (unlikely):** if quarterly narratives become hour-long jobs. We'd push to a worker before splitting a service.

Anything outside those three is almost certainly the wrong reason.

## Implementation checklist

Treating this as a small story (call it `FND-020` if we file it) — should be ~3 points:

- [x] `scripts/check-domain-boundaries.mts` — walks files, parses imports, checks allow-list.
- [x] `package.json` script `lint:boundaries`.
- [x] CI step (`.github/workflows/ci.yml`) after Lint, before Typecheck.
- [x] Allow-list snapshotted inline in the script with a pointer back here.
- [x] Verified clean against `main` (only `indc → coordination`, whitelisted).

Schema split is not on this checklist. It's queued behind ESUC-002.
