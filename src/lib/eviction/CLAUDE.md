# CLAUDE.md — `eviction` domain (EVDT)

## What this domain owns

End-to-end eviction defense pipeline: scrape the daily docket → upsert filings → risk-score → AI-draft response packet → render PDF → attorney triage view → outcome tracking → metrics. The Phase 1 flagship.

## Key files

**Ingestion:**
- `sources/` — pluggable scraper sources (synthetic, future CourtNet).
- `parser.ts` — parse raw docket text → `EvictionFiling` shape.
- `upsert.ts` + `upsert-rules.ts` — dedup logic; multiple sources may produce a row for the same case (uniqueness on `case_number, source`).

**Risk + triage:**
- `risk-score.ts` + `risk-band.ts` — Claude-graded risk score → low/medium/high band.
- `plaintiff-patterns.ts` — repeat-plaintiff detection.
- `children-detection.ts` — heuristic: does this household have minors? (no PHI; pattern-matched off public docket text).
- `docket-ranking.ts` — daily attorney triage queue ordering.
- `attorney-triage.ts` — KLA-attorney decision capture.

**Response packet:**
- `response-packet.ts` — Claude-drafted Answer to Forcible Detainer Complaint. Disclaimer fragments are non-negotiable; validated post-generation. Status flow: `draft → approved → filed | rejected`.
- `packet-pdf.ts` — PDFKit render.
- `outreach-letter-pdf.ts` + `tenant-outreach.ts` — proactive tenant outreach letter.
- `case-qa.ts` — AI Q&A over a single filing.

## AI prompts

In `src/ai/prompts/`: `attorney-triage.ts`, `case-qa.ts`, `eviction-response-packet.ts`, `eviction-risk-score.ts`, `eviction-tenant-outreach.ts`, `plaintiff-patterns.ts`, `synthetic-eviction-filings.ts`.

## Cross-domain dependencies

**Imports from:** `dtrs` only. **Imported by:** `oprt` (rate metrics, narrative).

## PHI status

**Clean.** Eviction filings are public court record. Defendant name + address are public via the docket. We segregate `defendant_*` columns from any future client-linked tables — the join to a real client row only happens post-BAA, mediated by a consent record.

## Conventions

- Multiple sources can produce the same filing; dedup is explicit via `(case_number, source)` uniqueness. Don't dedupe at query time — let upsert handle it.
- Response packets are versioned by `prompt_version`. Re-running the generator with the same version no-ops; bumping it inserts a new row alongside the old (attorney can compare).
- `eviction_response_packets.updated_at` is auto-bumped by trigger (migration 0032). Status writers don't have to remember.
- Outcomes are append-only; "latest outcome wins" is the convention for rate calculations (see `getMetricsRates` in `src/db/queries/metrics.ts`).

## Gotchas

- DV-flagged filings need address redaction for non-attorney roles — done via `dv-blind.ts` in `dtrs`. Always go through that helper.
- The disclaimer fragments live in `response-packet.ts`; bumping them requires bumping `EVICTION_RESPONSE_PACKET_PROMPT_VERSION` so old packets stay tied to the disclaimer they were generated under.
