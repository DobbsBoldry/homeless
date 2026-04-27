# CLAUDE.md — `coalition` domain

## What this domain owns

Coalition-level operations: weekly insights digest, steering committee agenda generation, AI Q&A over coordination data for coalition staff. Aggregate views and AI-assisted ops, not individual case work.

## Key files

- `weekly-insights.ts` — Claude-drafted weekly digest (filings, beds, super-utilizer signals) for coalition leadership.
- `steering-agenda.ts` — Claude-drafted Steering Committee meeting agenda from recent activity.
- `coordination-qa.ts` — AI Q&A surface over the bed-availability dataset (asked by coalition staff, *not* by clients — that's `indc`).

## AI prompts

In `src/ai/prompts/`:
- `coalition-insights.ts`
- `steering-agenda.ts`
- `coordination-qa.ts`

Pattern: each `<feature>.ts` here calls Anthropic and imports `<feature>_PROMPT_VERSION`, `<feature>_SYSTEM_PROMPT`, and the user-prompt builder from the matching prompts file. Bumping `_PROMPT_VERSION` in the prompts file is how we version-control AI surfaces.

## Cross-domain dependencies

**Imports from (per ADR 0001):** `coordination` only.
**Imported by:** `oprt` (which rolls everything up for transparency reports).

## PHI status

**Clean** in Phase 1. Coalition aggregate views never resolve to individual people. Post-BAA, this stays clean — PHI lives in `esuc` and `dtrs`, never bleeds here.

## Conventions

- Prompts read aggregated facts blocks (e.g. `buildCoordinationFactsBlock()`) — never raw query results inlined into the prompt.
- All AI outputs are versioned via the prompt version constant; downstream stores record which version produced the artifact.

## Gotchas

- This domain is named `coalition` (singular) but lives next to `coordination` — easy typo in import paths. Boundary lint catches cross-domain imports but not typos within a domain.
