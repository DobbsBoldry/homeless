# CLAUDE.md — `dtrs` domain (Data Trust)

## What this domain owns

The consent surface, the consent-text version-control, abuser-blind protections (DV-survivor address redaction), data-access policy gating, and the rate-limit primitive that protects consent submission. The "what data are we allowed to use, for whom, on what surfaces" layer.

**This is the most security-critical domain in the codebase.** Touch carefully.

## Key files

- `consent.ts` — consent record CRUD; the `CURRENT_CONSENT_VERSION` lives in `consent-text.ts` (bump on wording changes; advisor review per `docs/dtrs-005-advisor-review.md`).
- `consent-text.ts` — current and historical consent wording. Versioned. Never inline consent text anywhere else.
- `consent-token.ts` — opaque ref tokens for the `/p/[ref]/...` consent surfaces (no auth required, capability-bearer URL).
- `data-access.ts` — central policy gate: given `(viewer, target, data_class)` returns allow/deny. Every PHI read should route through this.
- `dv-blind.ts` — DV-survivor address redaction (`redactForRole`). Threat model: abuser obtaining survivor's new location through a coalition data leak.
- `rate-limit.ts` — bucketed rate-limit; in-memory today (#270 tracks Railway-restart persistence).
- `transparency-report.ts` — anonymized counts for the public transparency surface.
- `fiscal-court-brief.ts` — Claude-drafted fiscal court brief from quarterly outcomes.

## AI prompts

In `src/ai/prompts/`: `quarterly-narrative.ts` (used by `oprt` not us — but the brief here uses similar patterns).

## Cross-domain dependencies

**Imports from:** none. Leaf domain. **Imported by:** `cwt`, `esuc`, plus the consent surfaces in `src/app/p/[ref]/`.

## PHI status

**Will-be-PHI post-BAA.** `consent_records` link to people once ESUC-002 lands. The DV-blind tables already model PHI-adjacent risk (location data is PHI in DV context).

## Conventions

- Bumping consent wording = bump `CURRENT_CONSENT_VERSION` AND record a new `consents.consent_text_version` value on every new consent record. Old consents stay tied to the wording the person actually agreed to.
- DV redaction is server-authority. Don't rely on client-side hiding for `defendant_address` when `dv_flagged = true`.
- Rate-limit buckets are keyed by hashed phone (never raw phone) — see `consent-form.tsx` and Twilio-webhook code.
- Audit log every consent grant/revoke via `logAuditEvent` from `@/lib/audit`. The audit-log triggers (#198) make those rows immutable.

## Gotchas

- The consent surfaces at `/p/[ref]/...` run *unauthenticated* — the ref token is the capability. Don't add a Clerk gate; that breaks the use case.
- `INDC_CONSENT_OPEN_MODE` env flag bypasses token validation in dev/e2e — never `true` in prod.
- `rate-limit.ts` is in-memory; restart blows the bucket (real bug, tracked at #270).
