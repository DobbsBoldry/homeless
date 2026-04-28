# CLAUDE.md — `subp` domain (Subpopulation Pathways)

## What this domain owns

Pathway-specific logic for high-leverage subpopulations the coalition serves. Per `roadmap.html` Phase 2/3, these are: foster aging-out (SUBP-001/002), DV survivors (SUBP-004), reentry (SUBP-005), veterans (SUBP-006), older adults (SUBP-008), LGBTQ+ youth (SUBP-009), rural hidden (SUBP-010).

Today this domain holds the foster aging-out countdown and supporting helpers (DCBS gate, supports-in-place validation). Other pathways will land here as their stories ship; each has its own gate, its own controlled vocabulary, its own runtime contract.

## Key files

- `aging-out-engine.ts` — pure date math: `computeDaysUntilEighteen`, `computeMilestone`, `milestonesReachedBy`, `classifyTier`. No DB, no clocks. The Inngest job and tests both pass `asOf` explicitly.
- `dcbs-gate.ts` — runtime gate (per [ADR 0006](../../../docs/adr/0006-dcbs-data-sharing-privacy-contract.md)) that fail-closes individual-record ingest if no active DCBS DSA exists or `terms.individual_records_authorized=false`.
- `supports-in-place.ts` — validator + UI option lists for the structured `supports_in_place` JSONB on `foster_youth`.

## Cross-domain dependencies

**Imports from (per ADR 0001):** `dtrs` (the DCBS DSA gate looks up the active agreement via `getActiveAgreementByKind`).

**Imported by:** none yet. Future SUBP stories may surface to caseworker-side UI which will live in `cwt`-adjacent routes; that's composition-layer code, not a domain import.

## PHI status

**Will-be-PHI post-BAA.** Foster youth records are individual-record minor data — exactly what ADR 0006 governs. Pre-BAA: synthetic only. The seed generator (`scripts/gen-synthetic-foster-youth.ts`) plus the runtime DCBS gate together ensure no real records can land before the agreement infrastructure is correct.

## Conventions

- **Every individual-record write goes through `requireDcbsIndividualRecords(dcbsPartnerOrgId)`.** Bypassing this is a privacy bug. If you find a path that doesn't gate, fix it before shipping.
- The aging-out engine is pure. Don't add `new Date()` calls inside it; pass `asOf` from the caller (Inngest job, server action, test).
- Milestones are upper-edge inclusive (`d <= 90` → `d90`). The (youth, milestone) UNIQUE index makes the nightly scan idempotent — call `milestonesReachedBy` and INSERT … ON CONFLICT DO NOTHING.
- Audit-log every mutation: alert acknowledgement, supports-in-place edit, status change. The audit row references `target_table='foster_youth'` (or `foster_aging_out_alerts`) for forensic recovery.
- Synthetic legal names + DOBs only. Don't seed from real DCBS data, don't import production records here, don't echo DOB into AI prompts (when AI features ship for this domain).

## Gotchas

- **Date math is UTC-anchored.** `computeDaysUntilEighteen` normalizes both inputs to UTC midnight. Don't pass local-tz Dates directly without intent — see the engine's `toUtcMidnight` helper.
- **Leap-day DOBs (Feb 29).** JS Date wraps Feb 29 → Mar 1 in non-leap years. We accept that as the legal age-of-majority convention used by KY DCBS. If a future requirement disagrees, fix it in `computeDaysUntilEighteen` and add a test.
- **DCBS gate is per-partner.** The gate keys on `dcbs_partner_org_id`, so multiple regional DCBS offices each carry their own DSA + their own gate decision. Don't cache the gate across partners.
