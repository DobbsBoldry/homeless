# ADR 0007 — OASIS / DV survivor privacy contract (abuser-blind by contract, not by convention)

**Status:** Accepted — 2026-04-28
**Driver:** Sprint 11. DTRS-012 ([#360](https://github.com/DobbsBoldry/homeless/issues/360)) introduces the inbound flow for OASIS (Owensboro Area Shelter and Information Services) DV-survivor coordination. SUBP-004 ([#133](https://github.com/DobbsBoldry/homeless/issues/133)) builds on top — but no per-record survivor data may flow until the privacy contract for this relationship is specified. DV survivors are the first cohort where the threat model centers on a third party (the abuser) actively trying to obtain location through any data leak. The contract must encode that threat model directly.

## Context

Sprint 9 closed the schools entry under ADR 0005 (FERPA fork). Sprint 10 closed the foster-aging-out entry under ADR 0006 (DCBS state-as-guardian). Sprint 11 starts the DV survivor entry, which is structurally different from both:

| | FERPA (ADR 0005) | DCBS DSA (ADR 0006) | OASIS DSA (this ADR) |
|---|---|---|---|
| Consenter | Parent / eligible student (18+) | The state, as legal guardian (KRS 620.140) | The survivor, voluntarily, via OASIS ROI |
| Threat model | Identity exposure → stigma, services denial | State-custody data leakage → trust loss | Abuser obtaining survivor location → physical harm or death |
| Default rule | Forbidden without consent | Authorized to share with service providers | Suppress location-identifying fields by default; share only with explicit redaction-policy authorization |
| Cohort scale | Hundreds of students | Tens of youth | Tens of survivors |
| Statutory regime | 20 U.S.C. § 1232g; 34 CFR § 99 | KRS 620, 42 U.S.C. § 677, Family First | **KRS 209A**, VAWA (34 U.S.C. § 12291 et seq.) |
| Re-disclosure | Forbidden without § 99.31 exception | Forbidden without DCBS authorization or KRS 620.030 emergency | Forbidden without OASIS authorization, with mandatory notification when compelled |
| Audit obligation | District-side § 99.32 disclosure log | Coalition-side audit log; DCBS audit cooperation | **Coalition-side audit log on every read**, OASIS audit cooperation, breach → mandatory data-flow suspension |

The structural difference: in FERPA / DCBS, the threat is misuse by the receiving party; the contract constrains the Coalition's downstream behavior. In OASIS / DV, the threat is misuse by an external party (the abuser) who may obtain data through any link in the chain — including via the survivor's own coerced cooperation. The contract must therefore make abuser-blind discipline a *structural property of the data flow*, not a downstream policy that downstream code may or may not honor correctly.

The platform has built one prior abuser-blind primitive ([`src/lib/dtrs/dv-blind.ts`](../../src/lib/dtrs/dv-blind.ts)): a role-based address-redaction helper sitting on a `dv_flagged_persons` table that flags eviction defendants and ED encounters where a DV concern is noted. That primitive is sound but narrow — it operates inside individual domains (eviction, ED) and is invoked at render time. SUBP-004's middleware will *also* be invoked at every survivor-record read. The question this ADR answers is: where does the redaction policy live, and what is the source of truth?

## Decision

**Use the existing `partner_agreements` registry (ADR 0004) with `kind='dsa'` and `agency='oasis'`. Encode the abuser-blind redaction policy as a structured field on the JSONB `terms`. Treat the agreement's stored policy as the contract-of-record for SUBP-004's middleware.** Persist survivor records under the gate of an active OASIS DSA whose `abuser_blind_attestation` flag is `true` and whose `redaction_policy` covers every field in the controlled vocabulary.

### Privacy contract — five rules

1. **No survivor record may be persisted without an active OASIS DSA.** SUBP-004's ingest path reads `getActiveOasisDsa(oasisPartnerOrgId)` before every write batch and fails closed if no active agreement exists. Same gate applies on every read for reporting. Per ADR 0004 § 3.1.

2. **`abuser_blind_attestation` is non-optional.** The validator (`validateOasisDsaTerms`) refuses to accept a terms object without `abuser_blind_attestation === true`. The intake form's submit button is disabled until the attestation checkbox is checked. There is no draft path that bypasses attestation. If a future use case requires drafting an OASIS DSA without attestation, revisit this ADR — do not weaken the validator.

3. **The redaction policy is the contract-of-record.** SUBP-004's middleware reads `terms.redaction_policy` per request and applies the per-field treatment (`suppress` / `aggregate_only` / `share`). Adding a redactable field is a contract amendment (signed-by-both-parties), not a code change in isolation. The default policy (`OASIS_DEFAULT_REDACTION_POLICY` in `src/lib/dtrs/partner-agreements.ts`) suppresses every field that could leak survivor location. Relaxing a field requires explicit selection in the intake form and is recorded in the agreement's terms JSONB.

4. **Audit every read, not just every write.** Per § 4.3 of the template: every individual-record read of a survivor goes through `logAuditEvent` via the `read_survivor_record` action. The audit table is the source of truth for the cooperation obligation in § 6.3 of the template. SUBP-004's middleware enforces this — direct queries against `dv_survivors` outside the middleware are blocked by `scripts/check-domain-boundaries.mts`.

5. **No enumeration.** Coalition surfaces shall not disclose, even to authorized readers, the existence of a survivor record by name-based or identifier-guess query. Survivor records are accessible only via authenticated, role-authorized routes; cross-domain joins that would correlate survivor identity with non-survivor records are blocked at the `dtrs/data-access.ts` policy gate. A "does this person have an OASIS referral?" lookup is a P0 abuser-attack vector, not a feature request.

### What does NOT change

- ADR 0003 (faith-aggregate privacy contract) is unchanged. Faith partners remain aggregate-only with structural impossibility of identification.
- ADR 0005 (FERPA fork) is unchanged. Schools remain on the McKinney-Vento exception with `student_first_initial` only.
- ADR 0006 (DCBS state-as-guardian) is unchanged. Foster youth records flow under the state's custodial authority, distinct from a survivor's voluntary, abuser-blind opt-in.
- The existing `dv-blind.ts` primitive (role-based address redaction in eviction / ED contexts) is not deprecated. It continues to handle non-OASIS-sourced DV flags (e.g., a defendant in eviction court with a DV concern). SUBP-004's middleware is additive — it adds OASIS-sourced flow to the existing surfaces.

### Why this design and not alternatives

**Alternative A — separate `oasis_survivor_records` table and a parallel agreement-tracking table.** Rejected: re-litigates ADR 0004's "one agreement registry" decision, and worse, separates the policy from the agreement that authorizes it. If the registry and the table drift, the policy enforcement drifts with them.

**Alternative B — encode the redaction policy in `src/lib/dtrs/data-access.ts` as code, with the DSA being purely informational.** Rejected: the redaction policy is a *contractual* commitment OASIS makes about what the Coalition's software will do. Encoding it solely in code means OASIS and the Coalition negotiate a contract orally and then the engineer translates it; the translation step is where abuser-blind discipline gets lost. Encoding it in the agreement's `terms` JSONB makes the contract and the enforcement point be the same artifact. Code reads the contract, not vice versa.

**Alternative C — fork a third privacy regime like ADR 0005 did for FERPA.** Considered. The FERPA fork was structurally necessary because the consent surface (one consent record per subject) doesn't model FERPA's "parent consents on behalf of minor" + McKinney-Vento exception layering. OASIS doesn't need a fork: the consent surface is OASIS's own ROI process, which is upstream of the Coalition. The Coalition only sees the result (survivor opted in via OASIS) and applies the redaction policy. The agreement registry already accommodates this.

**Alternative D — make `validateOasisDsaTerms` accept `abuser_blind_attestation: false` for draft agreements.** Rejected: there is no legitimate use case for an OASIS DSA without abuser-blind discipline. If a draft path is ever needed (e.g., negotiating an early version), the agreement should be drafted outside this system and only entered into the registry once attested. Strict validation here is a feature, not a limitation.

## Consequences

**What we get:**

- DTRS-012 ships a working OASIS DSA workflow in 5 points: registry-extension, redaction-policy encoded in terms, attestation enforcement at the validator. Same shape as DTRS-011 / OPRT-002 pivots — minimal new surface area.
- SUBP-004's middleware reads `terms.redaction_policy` as its single source of truth. Changing the policy is a contract amendment with a new agreement row; the rendered template (`template_rendered`) preserves the legal artifact (ADR 0004 immutability).
- Cross-cutting: `getActiveOasisDsa(partnerOrgId)` is exposed via the dtrs barrel for any future SUBP-* survivor-adjacent stories (LGBTQ+ youth fleeing, families fleeing) to reuse the gate.
- Audit-on-read is the default, not an opt-in. The middleware is the only path to survivor records, and the middleware always logs.

**What we don't get:**

- Per-survivor consent variation. The OASIS DSA covers all survivors who have given OASIS-side ROI consent. Survivor-specific opt-outs (e.g., a survivor who consents to housing referrals but not legal referrals) are managed at OASIS, not in the Coalition's database. If the Coalition ever needs to model per-survivor consent, that's a separate ADR.
- Real-time notification of redaction-policy changes. Amendments take effect when the new agreement row is recorded as `active` and the prior one is `superseded`. Between those events, there's a brief window where SUBP-004 is reading the old policy. This is acceptable for the Sprint 11 scope; if it becomes a problem (e.g., an emergency policy tightening), we add a "policy version pin" check to the middleware.
- Automatic enforcement of "no enumeration." Rule 5 is implemented as code review + boundary lint, not as a runtime check. A future sprint may add fuzzing or property-based tests to verify enumeration-resistance.

**What we should watch for:**

1. **Drift between `terms.redaction_policy` and SUBP-004's middleware behavior.** This is the contract's most fragile point. Mitigations: (a) the middleware reads policy per-request, never caches; (b) add a contract test that exercises every field × every treatment combination; (c) any code change to the middleware that touches a redactable field requires reviewing the policy schema in this ADR.
2. **Templates becoming living documents.** Same concern as ADR 0004: `template_rendered` is set once at signing and treated as immutable. The form does not expose an edit path on rows with `status='active'`. Editing the template-version goes through a new agreement row.
3. **Multiple active OASIS DSAs for the same partner.** Pathological — only one should be active at a time. Don't enforce uniqueness at the DB (consistent with ADR 0004); let the form's "active-agreement warning" banner surface the conflict and let the admin supersede explicitly.
4. **Notification of breach to OASIS.** § 4.4 of the template requires breach notification within 24 hours. There's no automated piping for this today (Sentry-only); a follow-up story should add a notification path that pages OASIS-side contacts when a breach event lands. Until then, ops must monitor Sentry for `dtrs.oasis.*` errors and notify manually.

## Implementation checklist (DTRS-012 picks this up)

- [x] Lib: extend `src/lib/dtrs/partner-agreements.ts` with `OasisDsaTerms`, `OASIS_DSA_SCOPE_OPTIONS`, `OASIS_REDACTABLE_FIELDS`, `OASIS_DEFAULT_REDACTION_POLICY`, `validateOasisDsaTerms`. Update `validateAgreementTerms` dispatcher to handle `agency==='oasis'`.
- [x] Parser: add `parseOasisDsaAgreementForm` in `src/app/actions/partner-agreements-parse.ts` (sibling pure module per the `'use server'` × vitest quirk).
- [x] Action: add `recordOasisDsaAgreementAction` in `src/app/actions/partner-agreements.ts`.
- [x] Query: add `getActiveOasisDsa(partnerOrgId)` in `src/db/queries/partner-agreements.ts` using JSONB `terms->>'agency' = 'oasis'` filter.
- [x] Form component: `src/components/dtrs/oasis-dsa-agreement-form.tsx` with redaction policy fieldset + abuser-blind attestation checkbox.
- [x] Admin page: `src/app/app/admin/agreements/oasis/page.tsx`.
- [x] Public template: `src/app/agreements/oasis/template/page.tsx` (template version `oasis-dsa-v1`).
- [x] Tests: validator tests in `src/lib/dtrs/partner-agreements.test.ts`; parser tests in `src/app/actions/partner-agreements.test.ts`.
- [ ] SUBP-004 picks this up in a follow-up PR — its middleware reads `getActiveOasisDsa()` and `terms.redaction_policy`.
