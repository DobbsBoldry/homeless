# ADR 0002 — Clinical-note de-identification strategy

**Status:** Accepted — 2026-04-27
**Driver:** ESUC-002 BAA work + #247 (real de-id pipeline). Replaces the four-line regex stub that shipped with ESUC-011.

## Context

Pre-BAA, all ESUC work runs on synthetic data, so the de-id stub in `care-plan.ts` (4 regex patterns: phone, email, SSN, honorific+name) hasn't bitten anyone. Post-BAA, `ed_encounters.notes` will receive Epic FHIR-derived text that routinely carries PHI in patterns the stub misses:

- Provider names without honorifics ("signed off by Smith")
- Family-relationship + name ("daughter Mary present at bedside")
- Address fragments ("currently living at 123 Main")
- MRN-shaped strings (`MRN: 9876543`)
- Specific dates that combined with a diagnosis are reidentifying

Two questions to answer:
1. **Engine** — what scrubs the text?
2. **Application timing** — where in the pipeline does it run?

We considered four engines (regex, Microsoft Presidio, AWS Comprehend Medical, Claude API scrub-only call) and three timing options (prompt-only, ingest-only, both).

## Decision

**Engine: regex now, AWS Comprehend Medical post-BAA.**

| Pre-BAA (now) | Post-BAA |
|---|---|
| Pattern-based regex in `src/lib/esuc/scrub.ts`. Covers all leak vectors named in #247. Self-contained, zero deps, deterministic, free. | AWS Comprehend Medical de-identify API. HIPAA-eligible, NER-based, highest recall on contextual reidentifiers. The regex layer stays as a defense-in-depth pre-pass. |

Rationale for the staged approach:
- Pre-BAA we have no real PHI and no AWS BAA. Building an AWS integration now means paying for an AWS service we won't actually exercise on real data for months. Regex is enough for the synthetic case.
- Post-BAA, AWS Comprehend Medical (a) is HIPAA-eligible, (b) has the highest recall on the classes the regex deliberately misses (standalone names without honorifics or context, free-form addresses, misspelled relationship words, non-US identifiers), and (c) is a one-day integration when we're ready.
- We rejected Microsoft Presidio — strong recall, but self-hosting another service for one capability is operational drag we don't need on a solo team.
- We rejected Claude-API-scrub-only — extra round-trip latency on every care-plan generation, and the LLM-as-scrubber pattern has known failure modes (hallucinated redactions, missed-because-context-too-long).

**Timing: belt + suspenders — ingest AND prompt-build.**

| Layer | Where | Purpose |
|---|---|---|
| Ingest | `scripts/load-ed-encounters.ts` and the future Epic FHIR webhook | Primary line of defense. `ed_encounters.notes` never contains raw PHI — the column stores already-redacted text. Issue's AC explicitly requires this. |
| Prompt-build | `src/lib/esuc/care-plan.ts` (and any future caller) | Defense-in-depth. A regression in the ingest layer or a backdoor write through some other code path can't quietly leak PHI into a Claude prompt. |

The redundancy is the point. A regex regression that misses a vector at ingest will, at most, leak into a prompt where the (still-running) prompt-time scrub catches it. A regression in both layers is a very loud alarm — eval suite fails.

**Eval coverage.** `src/lib/esuc/scrub.test.ts` is the leak-vector eval. Every entry in `LEAK_VECTORS` is a realistic-but-synthetic note fragment containing a known-leaky pattern. The test asserts (a) the leak token is gone from the output and (b) the expected `[REDACTED-*]` marker is present. New leak vectors discovered in production (post-BAA) get a new entry. Build fails if any expected redaction is missed.

## Consequences

**What we get:**
- Synthetic-data Phase 1 is well-defended without AWS dependency.
- The post-BAA upgrade path is explicit and one-day-scoped — swap the engine inside `scrub.ts`, keep the public API stable, eval suite confirms no regression.
- Belt + suspenders means a single bug doesn't leak PHI.

**What we don't get:**
- True NER recall today. The regex misses standalone-name-without-context, misspelled relationship words, free-form addresses, and non-US identifiers. These are the classes that warrant the AWS upgrade.
- Idempotency guarantees against external write paths. If something other than `load-ed-encounters.ts` writes to `ed_encounters.notes`, it must call `scrubClinicalNote` itself. The boundary lint can't catch missed scrub calls — only `notes` writers in this domain can.

**Watch for:**
- A new `notes` writer landing without scrub. Every PR that touches `ed_encounters` insert/update should be reviewed for this.
- Eval suite becoming a maintenance burden. If the suite > 50 entries and every PR adds three more, refactor to fixture files.
- Post-BAA promotion. When the AWS BAA closes and Epic FHIR data flows, the `scrub.ts` engine swap is the implementation work; this ADR is what authorizes it.

## Implementation reference

- **Engine module:** `src/lib/esuc/scrub.ts` (regex implementation; `scrubClinicalNote(s)` is the public API)
- **Eval suite:** `src/lib/esuc/scrub.test.ts` (15+ leak vectors)
- **Ingest callsite:** `scripts/load-ed-encounters.ts:toRow()` (scrub before INSERT)
- **Prompt-build callsite:** `src/lib/esuc/care-plan.ts` (defense-in-depth)
- **AWS upgrade trigger:** ESUC BAA closure + Epic FHIR webhook (ESUC-005) reaching real data
