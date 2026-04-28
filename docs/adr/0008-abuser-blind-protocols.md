# ADR 0008 — Abuser-blind protocols (the structural defense)

**Status:** Accepted — 2026-04-28
**Driver:** Sprint 11. SUBP-004 ([#133](https://github.com/DobbsBoldry/homeless/issues/133)) introduces the first individual-record DV-survivor flow (built on DTRS-012 / ADR 0007). The privacy contract specifies *what* the discipline is; this ADR specifies *how* the codebase enforces it. The shape decided here will inherit to LGBTQ+ youth (SUBP-009) and any future survivor-adjacent pathway.

## Context

ADR 0007 named the threat model: an abuser obtaining a survivor's location through a coalition data leak — direct, indirect, or inferential. It also set the contract: `terms.redaction_policy` is the source of truth, `abuser_blind_attestation` is non-negotiable, no enumeration. SUBP-004 implements that contract.

Three specific code-level decisions need to be made:

1. Where does the per-row authorization gate live?
2. How is "no enumeration" enforced — at runtime, at lint, or both?
3. How are reads audited so the audit table is authoritative for the "every read of a survivor record" obligation?

## Decision

Enforce abuser-blind discipline through a four-layer defense:

### Layer 1 — Restricted-table boundary lint (compile-time)

The `dv_survivors` and `dv_safety_events` schema symbols are forbidden imports outside a narrow allow-list of paths:

- `src/lib/subp/` — domain owner; the only place `select … from dvSurvivors` is allowed.
- `src/db/schema/` — schema definition itself.
- `scripts/gen-synthetic-dv-survivors.ts` — synthetic seed; explicitly allow-listed.

`scripts/check-domain-boundaries.mts` enforces this with a third rule (alongside the existing allow-list and barrel-only rules from ADR 0001 / FND-040b). The lint runs in CI; a violating import is a build failure.

This is the load-bearing defense. Even if a future engineer forgets to call the runtime gate, they cannot accidentally write `db.select().from(dvSurvivors)` from a route handler — the import won't resolve through the lint.

### Layer 2 — Two-stage runtime gate

Every domain query in `src/lib/subp/dv-survivors.ts` calls two gates in order:

1. **OASIS DSA gate** (`requireOasisDsa(partnerOrgId)`): no read or write proceeds without an active OASIS DSA whose `terms.agency='oasis'` and `abuser_blind_attestation=true`. Throws `OasisGateDeniedError` on miss.

2. **Per-row abuser-blind reader check** (`requireSurvivorReader(viewer, survivor)`): the assigned advocate (caseworker) gets through; admin gets through; everyone else is denied. Throws `AbuserBlindDeniedError`.

The middleware functions are pure (no DB calls inside the decision logic) so the negative cases are unit-testable in isolation. The decision tree is exhaustive over `UserRole` — adding a new role without thinking through DV access fails compilation.

### Layer 3 — Anti-enumeration discipline

Three concrete rules:

- **404 indistinguishable from 403.** The detail route catches both `AbuserBlindDeniedError` and `OasisGateDeniedError` and surfaces them as `notFound()` to the client. An attacker probing for survivor IDs cannot distinguish "exists but you can't see it" from "doesn't exist."
- **Error messages do not echo the survivor id.** Test enforced — see `requireSurvivorReader.error message does NOT echo survivor id` in `abuser-blind.test.ts`. An auth-failure error must not become an enumeration oracle.
- **DB-layer filtering matches per-row authorization.** The list query (`listSurvivorsForViewer`) applies the assigned-advocate filter at the SQL `WHERE` clause, not in JS. Unauthorized rows never load into memory in the first place — defense-in-depth alongside the per-row check.

### Layer 4 — Audit-on-read

Every survivor record returned by the domain queries is logged to `audit_log` with action `dv_survivor.read`. Metadata is **id-only**: survivor id, OASIS partner id, viewer role, risk tier, status. **No names. No addresses. No needs-assessment values. No event content.** The audit table is the source of truth for the "every read" obligation in the OASIS DSA template § 4.3 / 6.3.

Audit-log writes are not transactional with the read (the read can succeed even if audit write fails — `logAuditEvent` already swallows errors and reports to Sentry). This is a deliberate trade-off: the operational cost of refusing a legitimate read because audit-write hiccupped is higher than the cost of a missing audit row that Sentry will surface anyway.

## What does NOT change

- The existing `src/lib/dtrs/dv-blind.ts` primitive (role-based address redaction in eviction / ED contexts) is unchanged. It handles non-OASIS-sourced DV flags (eviction defendants, ED encounters with a DV concern). SUBP-004's middleware is additive.
- ADR 0004 (partner-agreements registry) and ADR 0007 (OASIS privacy contract) are unchanged.
- The existing audit-log infrastructure handles the new `dv_survivor.read` action without schema changes.

## Why this design and not alternatives

**Alternative A — runtime-only gate (no boundary lint).** Rejected: a single missed gate-call in a future story is a P0 abuser-attack vector. The lint is the load-bearing defense; runtime is defense-in-depth. Lint catches the mistake before code review; runtime catches the mistake at request time. Both, not either.

**Alternative B — push field-level redaction into `dv-survivors.ts` (read the DSA's redaction_policy and apply per-field treatment in the query layer).** Considered for v1, deferred. The query layer returns the raw row; the renderer applies redaction. This is fine because:
- The schema itself omits the most dangerous fields (no address, no employer, no name). The redaction_policy in the OASIS DSA is more about future fields than about today's columns.
- A future story may push redaction down once the policy gets richer; the current shape is a deliberate v1 choice.

If field-level redaction becomes a runtime concern (e.g., a future amendment adds a sharable-by-default field that some agreements suppress), revisit and push the policy read into the query layer.

**Alternative C — share the boundary-lint pattern with foster_youth / DCBS.** Considered. Foster youth records are already gated by `requireDcbsIndividualRecords` at the runtime layer (ADR 0006). Adding a parallel restricted-table lint for `fosterYouth` would tighten that defense too. Deferred to a follow-up — the existing pattern works for DCBS because the threat model (state-custody minor data) doesn't have the same enumeration-oracle severity as DV. We can promote the pattern when it stops being a one-off.

**Alternative D — a single `dv_survivor_reads` audit table dedicated to survivor reads.** Rejected: the existing `audit_log` already supports per-action metadata, and concentrating reads here lets the platform-wide audit views work. A dedicated table is unnecessary complexity for a 2026-Q2 platform.

## Consequences

**What we get:**

- **Defense-in-depth.** The lint catches imports; the runtime gate catches runtime calls; anti-enumeration shields the failure surface; the audit log records every read. An attacker would need to defeat all four to exfiltrate location data.
- **Reusability.** SUBP-009 (LGBTQ+ youth) and any future survivor-adjacent pathway can adopt the same four-layer pattern. The middleware is at the abuser-blind level, not DV-specific.
- **Compile-time guarantee.** A new engineer can't accidentally write a route that bypasses the gate; the lint won't let them.
- **Predictable failure mode.** All deny paths surface as `notFound()` (404) at the route layer. Clients can't distinguish "denied" from "doesn't exist."

**What we don't get:**

- **Field-level redaction enforcement at the query layer.** Today's queries return the raw row; the renderer is responsible for honoring `terms.redaction_policy`. If a renderer forgets, a denied field could leak. This is mitigated by (a) the schema not containing the most dangerous fields, (b) the redaction_policy v1 covering only fields that don't exist in the schema yet (forward-looking). A future story should fold redaction into the query layer once the policy gets richer.
- **Cross-domain enumeration prevention.** The boundary lint stops `dv_survivors`-table imports outside subp, but a determined attacker with control over a different domain (eviction, ED) could still correlate a defendant or patient with a known DV survivor by inference. This requires further work: cross-domain join-blocking at `dtrs/data-access.ts` (mentioned in ADR 0007 § 4.2 of the template). Tracked as a follow-up; out of scope for SUBP-004.
- **Real-time policy-tightening.** A redaction-policy amendment takes effect when the new agreement row is recorded `active` and the prior is `superseded`. Brief drift window between events.

**What we should watch for:**

1. **Drift between the lint allow-list and reality.** If `gen-synthetic-dv-survivors.ts` is renamed, the allow-list misses it and CI fails. Catchable, fixable, but worth being explicit about. Same for any future privileged-system script.
2. **Audit-log volume.** Every survivor read logs a row. For a 25-survivor synthetic dataset, this is fine; for a future production cohort of hundreds, the audit-log table may need partitioning. Track at the `audit_log` level if it becomes a concern.
3. **The `notFound()` indistinguishability is a UX cost.** A legitimate user who can't see a record gets 404 with no explanation. This is the right trade-off — leaking "exists but you can't see" turns the app into an enumeration oracle — but support tickets in this area should be prioritized so users understand the failure mode.

## Implementation checklist (SUBP-004 picks this up)

- [x] Schema: `dv_survivors`, `dv_safety_events`, plus `dv_survivor_status`, `dv_risk_tier`, `dv_safety_event_type` enums. No name, address, or employer columns.
- [x] Migration: `0040_SUBP-004_dv_survivor_pathway.sql`.
- [x] Middleware: `src/lib/subp/abuser-blind.ts` — `isAuthorizedReader`, `requireSurvivorReader`, `AbuserBlindDeniedError`. Pure functions, vitest-covered including negative cases.
- [x] Runtime gate: `src/lib/subp/oasis-gate.ts` — `checkOasisGate`, `requireOasisDsa`, `OasisGateDeniedError`.
- [x] Domain queries: `src/lib/subp/dv-survivors.ts` — `listSurvivorsForViewer`, `getSurvivorByIdForViewer`, `listSafetyEventsForSurvivor`, `listStaleSafetyPlans`. Audit-on-read.
- [x] Boundary lint: extend `scripts/check-domain-boundaries.mts` with restricted-table rule for `dvSurvivors` / `dvSafetyEvents`.
- [x] Surfaces: `/app/clients/dv-survivors` (list, assigned-advocate filter) and `/app/clients/dv-survivors/[id]` (detail, 404-indistinguishable-from-403).
- [x] Inngest: `dv-safety-plan-stale-scan` (Mondays 13:00 UTC) — flags active survivors with safety plans not reviewed in 90+ days.
- [x] Synthetic seed: `scripts/gen-synthetic-dv-survivors.ts` — ensures OASIS partner_org + active OASIS DSA + ~13 survivors across the risk-tier × status grid.
- [ ] Cross-domain join-blocking (mentioned above) — follow-up story, not SUBP-004's scope.
