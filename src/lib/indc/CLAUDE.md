# CLAUDE.md — `indc` domain (Individual Companion)

## What this domain owns

The SMS interface for unhoused individuals. Inbound text arrives → parse intent → look up beds (via `coordination`) → format reply → send. Plus bed-hold flow (user texts, shelter holds a bed for them) and stateful conversation (`awaiting_location` etc.).

The only end-user-facing surface that runs over Twilio.

## Key files

- `sms-pipeline.ts` — orchestrator: webhook → parse → respond → record.
- `sms-parser.ts` — parse inbound text into intents (`bed`, `where`, `help`, location response, etc.).
- `sms-conversation.ts` — conversation state machine (`idle | awaiting_location`).
- `sms-formatter.ts` — outbound message formatting (length-aware, no PHI leakage).
- `bed-finder.ts` — query `coordination/bed-availability` for matching shelters.
- `bed-summary.ts` — render bed list in SMS-friendly form.
- `sms-bed-holds.ts` — bed-hold creation/expiration flow (S6 e2e covers expiration).
- `twilio-signature.ts` — verify inbound webhook signature.

## AI prompts

None directly today — the SMS surface is intentionally rule-based for predictability. Future text-shorthand expansion (INDC-019) might add a small Claude classifier; that'd be a deliberate decision.

## Cross-domain dependencies

**Imports from (per ADR 0001):** `coordination` only (bed lookups). **Imported by:** `oprt`.

The `indc → coordination` dep is the single legitimate cross-domain import in the codebase pre-ADR-0001. It's why the allow-list isn't empty.

## PHI status

**Sensitive-not-PHI in Phase 1.** SMS messages and conversation state are stored, but content is operational ("BED" / "downtown" / "Boulware accepts pets") not clinical. Phone numbers are hashed, never raw, in any cross-table reference.

Post-BAA: `sms_messages.body` could contain user-disclosed PHI (e.g. "I have diabetes, do they have insulin storage?"). Treatment of PHI in SMS body is a Phase 2 design decision — see INDC-007 (privacy-respecting log) and INDC-018.

## Conventions

- All Twilio webhook handlers verify the X-Twilio-Signature header via `twilio-signature.ts`. CI test (`twilio-signature.spec.ts`) catches bypasses.
- Phone numbers are hashed before any cross-table key. Raw phone never persists outside `sms_messages`.
- `E2E_MOCK_OUTBOUND=1` skips actual Twilio API calls — used by e2e setup. Don't accidentally remove this gate.
- SMS responses are length-bounded to fit a single 160-char segment when possible; multi-segment is acceptable for bed lists but should be flagged in tests.
- `INDC_CONSENT_OPEN_MODE` is dev-only — bypasses ref-token validation on the consent surface.

## Gotchas

- Twilio sends multi-value params (multi-line `Body`); webhook hygiene (#269 follow-up) is open work.
- The rate-limit bucket protecting inbound SMS lives in `dtrs/rate-limit.ts` and is in-memory — Railway restarts blow it (#270).
- Bed-hold expiration is enforced by an Inngest scheduled function, NOT a Postgres trigger. If you change the expiration window, update both the Inngest schedule and the test fixture.
