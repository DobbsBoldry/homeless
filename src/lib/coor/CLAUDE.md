# CLAUDE.md — `coor` domain (Inter-Agency Coordination)

## What this domain owns

Cross-agency routing primitives. Today: the consent-gated case handoff (COOR-012). Future: referral routing across orgs, demand forecasting, donation matching.

Distinct from `coordination/` (which owns the bed-availability primitive — different layer of "coordination"). The naming is unfortunate but locked in for now.

## Key files

- `handoff.ts` — state machine for `case_handoffs`. `initiateHandoff`, `recordHandoffConsent`, `acceptHandoff`, `declineHandoff`, `revokeHandoff`, `expireHandoff`, plus the `assertHandoffPermitted` governance gate. Pure helpers: `validateRequestedScope`, `computeExpiresAt`, `nextStatus`.
- `handoff-context.ts` — the consent-gated reader. `loadHandoffContext` is the **only** path that returns transferred records; every call audits. Pure helper: `validateConsentForRead`.
- `index.ts` — barrel export.

## Cross-domain dependencies

**Imports from (per [ADR 0001](../../../docs/adr/0001-modular-monolith.md)):** `audit`, `db/queries/case-handoffs`, plus pure schema types from `db/schema/*`. The fetchers in `handoff-context.ts` reach into `clientIntakes`, `clientCaseNotes`, `partnerServiceEvents`, `consents` — these are read-only references to tables owned by other domains (`cwt`, `dtrs`).

**Imported by:** server actions in `src/app/actions/handoff.ts`. The CWT-022 caseworker UI will be the next consumer.

## PHI status

**Will-be-PHI post-BAA.** Today the handoff records reference `synthetic_person_ref` only, but the *purpose* of the handoff (free text) and the records the receiver pulls (intakes / case notes / service events) lift PHI as the platform matures. Treat the audit log on `case_handoff.context_read` as the forensic record of who saw what.

## Conventions

- **Two gates, every time.** `initiateHandoff` runs the governance gate (`assertHandoffPermitted`); `loadHandoffContext` runs governance + receiver-membership + consent. Don't add an alternate read path that bypasses either.
- **Audit every transition AND every context read.** The `logAuditEvent` calls inside the state-machine functions and the context loader are not optional. Any new operation that mutates a handoff or returns its context MUST audit.
- **Consent-pre-dates-accept rule.** A handoff that's already `accepted` should NOT auto-re-authorise after a revoke + new grant. The validator (`validateConsentForRead`) compares `consent.granted_at` to `handoff.accepted_at` — if the grant is newer, the read fails closed and the receiver must re-prompt for a fresh accept. Don't relax this.
- **DB I/O lives in `@/db/queries/case-handoffs`, not here.** Tests mock that module to exercise the state machine without a Postgres. New mutations: add a query function, then call it from the lib.
- **Scope kinds are a privacy contract.** Adding a new value to `case_handoff_scope_kind` is a privacy-policy change, not a refactor. New kinds need a fetcher in `handoff-context.ts` AND a corresponding case in `summarizeScope`. `triage_overrides` was intentionally dropped because the table has no `synthetic_person_ref` column.

## Gotchas

- **`partner_agreements` is the live signal, not `partner_orgs.data_sharing_tier`.** The seed sets the tier statically; the real "is this org currently authorised" answer is "do they have an active agreement on file?" The gate keys on the agreement, not the tier.
- **`memo_of_cooperation` validator throws.** It's a placeholder kind whose intake story hasn't shipped. Synthetic seeds must use `mou` (which has a real validator) instead. See `scripts/gen-synthetic-handoffs.ts`.
- **The expiry sweep is idempotent.** It calls `expireHandoff` per-row inside `step.run`; per-row failures are captured in Sentry and don't tank the sweep. Don't add a batched UPDATE — the per-row audit row is the point.
- **UI surfaces are CWT-022, not here.** Caseworker inbox, case-page initiate button, accept/decline buttons, notifications all belong to the (8pt) CWT-022 layer that sits on top of these primitives. Don't add components in this domain.
