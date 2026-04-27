# CLAUDE.md — `esuc` domain (ED Super-Utilizer Care)

## What this domain owns

ED super-utilizer pipeline: ingest ED encounter signals → rank patients by super-utilizer-ness → AI-graded triage → AI-drafted care plan → care-plan review/edit → care coordination handoff. The other Phase 1 flagship besides eviction.

**Highest-PHI domain.** Real ED encounters are PHI; nothing here lands pre-BAA.

## Key files

- `super-utilizer-ranking.ts` — score patients by 12-month ED visit pattern.
- `ed-triage.ts` — Claude-graded triage tier from encounter signals.
- `care-plan.ts` — Claude-drafted care intervention plan. Status flow: `draft → approved → active → archived`.
- `patient-qa.ts` — AI Q&A over a single patient's encounter history.

## AI prompts

In `src/ai/prompts/`: `ed-triage.ts`, `esuc-care-plan.ts`, `patient-qa.ts`, `synthetic-ed-encounters.ts`.

## Cross-domain dependencies

**Imports from (per ADR 0001):** `coordination`, `dtrs`. **Imported by:** `oprt`.

## PHI status

**Hard PHI fence.** Until the Owensboro Health BAA is signed and ESUC-002 (HIPAA migration) lands:
- No real PHI in the database
- No real PHI through any AI call
- All work runs on synthetic encounters (`scripts/gen-synthetic-ed-encounters.ts`)

ESUC-002 trigger conditions also justify the schema-per-domain Postgres split discussed in ADR 0001 — the PHI tables (`ed_encounters`, `esuc_care_plans`, `client_documents`, `client_intakes`) move to a dedicated `phi.*` schema with separate role grants.

## Conventions

- Every Claude call routes through the HIPAA-eligible Anthropic endpoint post-BAA. The dev/synthetic path uses the standard endpoint.
- Care plans are versioned (every approval bumps version); old versions stay queryable.
- Triage overrides (`triage_overrides` table) capture human disagreement with AI grading — that's a feedback signal for prompt iteration, not a bug.
- Real de-identification of free-text clinical notes is open work (#247) — current pipeline is a stub. Until that ships, no production PHI through extraction.

## Gotchas

- Super-utilizer ranking has cohort thresholds (e.g. 4+ visits / 12 months). Those are policy choices, not magic numbers — change with care; document the change in an ADR or care-plan note.
- The synthetic ED encounter prompt deliberately includes messy formatting and OCR artifacts — that's the test for downstream robustness. Don't sanitize.
- Super-utilizer status itself is sensitive (it implies frequent ED use, which intersects mental health / SUD / housing instability) — even *aggregate* counts can deanonymize in a county this size. Aggregate-only displays must use the `dtrs.transparency-report` k-anon thresholds.
