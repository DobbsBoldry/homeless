# CLAUDE.md — `cwt` domain (Caseworker Tools)

## What this domain owns

Caseworker-facing tooling: conversational client intake, AI case-note drafting, document extraction, benefits screening, triage tier assignment, follow-up SMS, pre/post-meeting AI summaries.

## Key files

**Intake + extraction:**
- `intake-extraction.ts` — Claude extracts structured fields from a free-form intake transcript.
- `intake-to-screener.ts` — feeds extracted intake into the benefits screener.
- `document-extraction.ts` — Claude extracts data from uploaded docs (KY ID, paystub, lease, etc.) — see `client_document_kind` enum for the supported set.

**Triage + benefits:**
- `triage.ts` + `cwt-triage.ts` — assign high/medium/low tier with AI rationale.
- `benefits.ts` — benefits screener (KTAP, SNAP, KCHIP, KY HEALTH).

**Notes + comms:**
- `case-note-generator.ts` — Claude-drafted case note from session transcript.
- `person-qa.ts` — AI Q&A over a single client's record.
- `post-meeting-notes.ts` + `pre-meeting-summary.ts` — meeting prep + recap drafts.
- `followup-sms.ts` — Claude-drafted follow-up SMS to client.

## AI prompts

In `src/ai/prompts/`: `case-note-generator.ts`, `cwt-triage.ts`, `document-extraction.ts`, `followup-sms.ts`, `intake-extraction.ts`, `person-qa.ts`, `post-meeting-notes.ts`, `pre-meeting-summary.ts`, `synthetic-intake.ts`.

## Cross-domain dependencies

**Imports from (per ADR 0001):** `coordination`, `dtrs`. **Imported by:** `oprt`.

## PHI status

**Phase 1: synthetic-only.** All caseworker work runs against synthetic data (CWT-001 generator). No real PHI lands here pre-BAA. Once ESUC-002 ships and the BAA is signed, `client_intakes`, `client_documents`, `client_case_notes`, etc. become real-PHI tables and route through the HIPAA-eligible Anthropic endpoint.

## Conventions

- Every Claude call here is gated: in dev/e2e, it returns a deterministic stub via `E2E_MOCK_OUTBOUND`; in prod (post-BAA), routes through the HIPAA endpoint with a different API key.
- Case notes are versioned (CWT-005 history) — never overwrite an old note; insert a new version and supersede.
- Document extraction status flow: `uploaded → extracting → extracted | failed`.
- Intake transcript handling: transcript is PHI; extraction output is structured PHI; both live behind `dtrs.data-access` policy gates.

## Gotchas

- The triage tier UI is FAG-defined (per the strategy doc) — what counts as "high" is configurable per agency. Don't hardcode thresholds in this code.
- Synthetic intake transcripts (`synthetic-intake.ts` prompt) are intentionally messy — that's how we test extraction robustness. Don't "clean them up."
