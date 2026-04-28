# ADR 0003 — Faith-aggregate privacy contract

**Status:** Accepted — 2026-04-27
**Driver:** DTRS-007 (#137). Phase 2 entry priority per `strategy/data.html` § 6 and `product-vision/roadmap.html` "What ships in Phase 2 — New partner integrations."

## Context

Phase 2 begins with faith-based opt-in. Catholic Charities Owensboro (the umbrella) and individual parish ministries (Aid the Homeless, Feeding Our Friends, etc.) will share service data with the coalition. Two non-negotiables drive the design:

1. **The Diocese will not consent to a flow that names individuals.** From `strategy/partnerships.html`: "Pluralism preservation, mission accommodation, no obligation to enroll in HMIS, voluntary participation throughout. Lead with respect, not pitch." Faith partners participate via aggregate counts only — never individual records, never identifiers.

2. **Small cells leak.** A Tuesday-evening parish counsel of 3 visitors, broken out by veteran status, can effectively identify a person. The standard mitigation is k-anonymity at the cell level (see the OMU-utility flow in `strategy/data.html`: "N>10 minimum cell-size for any reported value").

This ADR captures the contract the schema (DTRS-007), intake form (DTRS-008), and coordination signals (DTRS-009) all hang on.

## Decision

### Aggregate-only at the schema level

Four tables, all under `src/db/schema/`:

| Table | Owns |
|---|---|
| `faith_ministries` | Opted-in ministries (umbrella + parishes). Per-ministry `min_cell_size` threshold (default 10). |
| `faith_aggregate_submissions` | One row per (ministry, period). Period bounds + the coalition-side user who entered the form. |
| `faith_aggregate_metrics` | Counts by `metric_key` (`meals_served`, `visits_total`, etc.). `value` is `NULL` when suppressed. |
| `faith_aggregate_breakouts` | Demographic counts by `(dimension, bucket)`. Same suppression contract. |

**There is no individual-record table.** No `synthetic_person_ref`, no opaque identifier. The data model itself cannot represent individual-level data — privacy by structural impossibility, not by policy alone.

### Cell-size suppression — applied client-side, enforced in code

`src/lib/dtrs/faith-aggregate.ts::applySuppression(raw, threshold)`: if `raw < threshold`, return `{ value: null, suppressed: true }`. The raw small-cell value is never written to the DB.

Strict reading of "the raw value is never stored": the suppression function runs in the form handler (DTRS-008), which sees the raw count momentarily on the request path, then hands the suppressed cell to the query layer. Knowledge of the small cell exists in process memory for ~milliseconds, then is discarded. Server-process memory under signed MOU governance is the trust boundary; anything written to the database is the artifact.

Threshold is per-ministry (`faith_ministries.min_cell_size`, default 10). Ministries with sensitive populations (e.g. a small recovery group at a parish) can set higher; nobody can set lower than 1.

### DB-level CHECK constraints back the contract

```sql
CHECK ((value IS NOT NULL AND suppressed = false)
    OR (value IS NULL AND suppressed = true))
CHECK (value IS NULL OR value >= 0)
```

Either the value is concrete and not-suppressed, or it's NULL and suppressed. No "stored a small value but didn't mark it suppressed" loophole. Same for breakouts.

### Controlled vocabulary, not free text

Both metric keys and breakout dimensions/buckets are fixed at the application layer (`FAITH_METRIC_KEYS`, `FAITH_BREAKOUT_DIMENSIONS`). Adding a new metric is a deliberate change touching the lib + the form + the lookups. This:

- Keeps the macro demand picture comparable across ministries (the strategy doc's main use case).
- Prevents "free-text demographic field" privacy bombs (e.g. "single mom on disability in east end" as a bucket).
- Forces a review when new categories enter the system.

## Consequences

**What we get:**

- Faith partners can sign an MOU that says "the platform structurally cannot store individual records about your visitors" — and that's true, not just policy.
- The k-anonymity threshold is a single configurable knob. If the Diocese asks for higher, change the default + push a per-ministry override.
- Coordination signals back to ministries (DTRS-009) are bound to the same aggregate constraints — any reverse data flow inherits the contract automatically.

**What we don't get:**

- We can never deduplicate across ministries. If three parishes each report 12 first-time visitors, we count 36 — even if they're the same 12 people. This is the *intended* trade-off — deduplication requires identifiers we explicitly don't collect.
- Cross-signal correlation with EVDT/ESUC/CWT is impossible at the individual level. Faith data is a separate macro layer.
- DTRS-007's data is operational stewardship only; it does not roll into the per-person consent flow under DTRS or the post-BAA PHI surface.

**What we should watch for:**

1. **Pressure to add a "person token" for dedup.** This would void the contract. Hold the line.
2. **A ministry reporting only suppressed values for a period** — that's a signal the threshold is too high for their volume. Either accept the lossiness or split their reporting cadence. Don't lower the threshold without privacy-advisor review.
3. **Phase 3 coordination signals (DTRS-009 back-channel).** Aggregate-only there too, or the contract collapses.

## Implementation checklist (DTRS-007)

- [x] Drizzle schema for all four tables (`src/db/schema/faith-ministries.ts`, `faith-aggregate-submissions.ts`).
- [x] Migration `0034_DTRS-007_faith_aggregate_schema.sql` following the FND-040e naming convention.
- [x] Domain logic in `src/lib/dtrs/faith-aggregate.ts`: `applySuppression`, `processMetrics`, `processBreakouts`, `validatePeriod`, controlled vocabulary.
- [x] Unit tests covering suppression, vocabulary validation, period coherence.
- [x] Query layer in `src/db/queries/faith-aggregate.ts`: ministry CRUD plus a transactional `createFaithAggregateSubmission` that runs suppression up-front, inserts submission + metrics + breakouts, writes a `faith_aggregate.submitted` audit-log entry.
- [x] Barrel re-export in `src/lib/dtrs/index.ts`.
- [ ] DTRS-008 (#138) — Catholic Charities intake form — picks up where this ends.
- [ ] DTRS-009 (#139) — per-ministry coordination signals.
