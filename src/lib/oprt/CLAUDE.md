# CLAUDE.md — `oprt` domain (Operations / Transparency / Reporting)

## What this domain owns

Cross-domain rollups for transparency, accountability, and outside-facing narratives: quarterly outcomes report, fiscal court brief, narrative drafting. The "everything in aggregate, told as a story" layer.

## Key files

- `quarterly-narrative.ts` — Claude-drafted quarterly outcomes narrative pulling from every domain.

(Domain is small today; more files land as Phase 1 reporting expands.)

## AI prompts

In `src/ai/prompts/`: `quarterly-narrative.ts` (this file's pair).

## Cross-domain dependencies

**Imports from (per ADR 0001):** `coalition`, `coordination`, `cwt`, `esuc`, `eviction`, `indc`. The widest allow-list of any domain — and that's by design. Operations/transparency is *the* read-only consumer of every other domain's output.

**Imported by:** none. Top of the dependency graph.

## PHI status

**Clean by construction.** Everything that flows into `oprt` rollups is either aggregate counts or already-anonymized. Per the `dtrs.transparency-report` k-anon thresholds, no oprt output should resolve to a single individual.

## Conventions

- Read-only against every upstream domain. Never mutate state owned by another domain from here.
- Aggregate first, then narrate. The Claude prompts in this domain receive *facts blocks* (counts, rates, named buckets) — never raw rows. If you find yourself feeding a row dump into the prompt, refactor the upstream query.
- Public-facing narratives go through the same disclaimer/citation discipline as `eviction/response-packet.ts` — track which prompt version produced which artifact.

## Gotchas

- Quarterly narrative pulls from many domains; if any one of them changes its public API (e.g. a `getMetricsRates` signature change), oprt callsites need updating. The boundary lint catches the import path; tests catch the signature.
- The fiscal-court-brief surface lives in `dtrs/` (because it's about the data-trust accountability story), not here. Don't get them confused.
