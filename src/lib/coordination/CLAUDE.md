# CLAUDE.md — `coordination` domain

## What this domain owns

Real-time bed availability across the three anchor shelters (Boulware Mission, St. Benedict's, Daniel Pitino). The "is there a bed open right now" capability — not the conversation that uses it (that's `indc`), not the rolled-up dashboards (that's `coalition`).

## Key files

- `bed-availability.ts` — single source of truth: `freeBeds()`, `effectiveFreeBeds()` (subtracts active holds), `BedFilter` parsing, occupancy math.

That's the whole domain right now. It's a leaf.

## AI prompts

None directly. `coordination-qa.ts` (an AI Q&A over coordination data) lives in `coalition/`, not here, because it's a coalition-facing capability that *uses* coordination data.

## Cross-domain dependencies

**Imports from:** none. This is a leaf — the boundary lint enforces nothing imports inward.
**Exported to (per ADR 0001):** `coalition`, `cwt`, `esuc`, `indc`, `oprt`. The bed-availability data model is the most-shared primitive in the codebase.

## PHI status

**Clean.** Bed counts and shelter capacity are operational data, never PHI. Stays this way post-BAA.

## Conventions

- All bed math goes through `effectiveFreeBeds()` — never compute `capacity - occupancy` inline. Active bed holds (from `bed_holds` schema) must be subtracted.
- Filters parse defensively from URL params (`parseBedFilterParams`) — clients can send anything; we coerce to known shelter feature flags.

## Gotchas

- The `bed_count_updates` table is the source of truth for occupancy (append-only history); current occupancy is the latest row per shelter. Don't UPDATE shelter occupancy in place.
