# ADR 0009 — KY DOC reentry data-sharing privacy contract (state-as-custodian, narrow window, no recidivism prediction)

**Status:** Accepted — 2026-04-28
**Driver:** Sprint 12. DTRS-013 ([#142](https://github.com/DobbsBoldry/homeless/issues/142)) introduces the inbound flow for the Kentucky Department of Corrections (KY DOC) to support SUBP-005 (Reentry pathway, [#134](https://github.com/DobbsBoldry/homeless/issues/134)). The reentry use case is the third state-authorized data-sharing relationship after DCBS (ADR 0006) and OASIS (ADR 0007). It needs its own privacy contract because the cohort, the threat model, and the statutory regime differ from both.

## Context

Sprint 10 closed the foster-aging-out entry under ADR 0006 (DCBS state-as-guardian — the state holds custodial authority and authorizes downstream sharing). Sprint 11 closed the DV-survivor entry under ADR 0007 (OASIS abuser-blind, where the threat model centers on a third-party adversary). Sprint 12 starts the reentry entry, which is structurally distinct from both:

| | DCBS (ADR 0006) | OASIS (ADR 0007) | KY DOC (this ADR) |
|---|---|---|---|
| Cohort | Foster youth in state custody | DV survivors voluntarily enrolled with OASIS | Incarcerated people approaching release |
| Custodial authority | The state, as legal guardian (KRS 620.140) | The survivor herself (voluntary OASIS ROI) | The state, as custodian during incarceration (KRS Chapter 197) |
| Threat model | State-custody data leakage → trust loss + potential placement disruption | Abuser obtaining survivor location → physical harm or death | (a) stigma-driven housing/employment denial; (b) misuse for recidivism prediction; (c) re-identification by parole / law-enforcement secondary use |
| Default rule | Authorized to share with service providers per state DSA | Suppress location-identifying fields by default; share only with explicit redaction | Authorized to share narrow pre-release fields under DOC DSA; **no recidivism inference, no parole-supervision data flow without separate authorization** |
| Cohort scale | Tens of youth | Tens of survivors | Tens to low hundreds of pre-release individuals (Daviess Co. residents in KY DOC custody approaching release) |
| Statutory regime | KRS 620, 42 U.S.C. § 677, Family First | KRS 209A, VAWA (34 U.S.C. § 12291 et seq.) | **KRS Chapter 197** (Department of Corrections), **KRS Chapter 439** (probation and parole), the federal Second Chance Act (42 U.S.C. § 17501 et seq.), and the Kentucky Reentry Council mandate |
| Re-disclosure | Forbidden without DCBS authorization or KRS 620.030 emergency | Forbidden without OASIS authorization, with mandatory notification when compelled | Forbidden without KY DOC authorization; **explicit prohibition on disclosure to law enforcement, parole, or probation absent court order** |
| Window of receipt | Continuous while youth is in state custody, plus a tail under TEAMKY | Continuous while survivor enrolled with OASIS | **Bounded** — a configurable pre-release window (default 60 days) before projected release, plus a short tail post-release for warm-handoff coordination only |
| Audit obligation | Coalition-side audit log + DCBS audit cooperation | Coalition-side audit log on every read + OASIS audit cooperation + breach → mandatory data-flow suspension | **Coalition-side audit log on every read**, KY DOC audit cooperation, breach → mandatory KY DOC notification within 72 hours |

**Why a window matters.** The reentry use case is fundamentally a coordination problem on a clock: roughly 60 days before projected release is when housing, healthcare, and employment supports must be lined up so the released individual does not return to homelessness. Data older than that window adds nothing operationally and adds risk (stale records, drift between custody status and actual release date, increased blast radius if breached). The contract therefore makes the window a structural property of the data flow — KY DOC sends only records inside the window, the Coalition deletes records that age out of the window, and the runtime gate enforces both directions.

**Why "no recidivism prediction" is in the contract.** Reentry support is fundamentally different from probation supervision. The Coalition's purpose is to help a person succeed at re-entry by lining up housing, healthcare, employment, and family connection. It is *not* to predict whether the person will reoffend. The contract makes this explicit because the same data (release date, supports-in-place, prior-incarceration history) could in principle be repurposed for actuarial recidivism scoring — and there is a documented record of well-intentioned reentry tools drifting in that direction once the data is in hand. Encoding the prohibition in the agreement, not just the policy, makes drift a contractual breach rather than a code review failure.

The platform already has the registry infrastructure ([ADR 0004 modular monolith / partner_agreements](./0004-modular-monolith.md)), the per-partner-org agreement-recording pattern ([DTRS-010 FERPA #359](https://github.com/DobbsBoldry/homeless/pull/359), [DTRS-011 DCBS #364](https://github.com/DobbsBoldry/homeless/pull/364), [DTRS-012 OASIS #370](https://github.com/DobbsBoldry/homeless/pull/370)), and the generic expiration watcher ([OPRT-002 #368](https://github.com/DobbsBoldry/homeless/pull/368)). The question this ADR answers is: where does the reentry-specific privacy contract live, and what is the source of truth for SUBP-005's runtime gates?

## Decision

**Use the existing `partner_agreements` registry (ADR 0004) with `kind='dsa'` and `agency='ky_doc'`. Encode the reentry-specific contract — pre-release window length, individual-records authorization, no-recidivism-prediction acknowledgement, and population focus — as structured fields on the JSONB `terms`. Treat the agreement's stored terms as the contract-of-record for SUBP-005's pre-release gates.** Persist any pre-release roster record under the gate of an active KY DOC DSA whose `individual_records_authorized` flag is `true` and whose `pre_release_window_days` covers the record's projected-release horizon.

### Privacy contract — six rules

1. **No pre-release record may be persisted without an active KY DOC DSA.** SUBP-005's ingest path reads `getActiveKyDocDsa(kyDocPartnerOrgId)` before every write batch and fails closed if no active agreement exists. Same gate applies on every read for reporting. Per ADR 0004 § 3.1.

2. **`individual_records_authorized` is the runtime authorization gate.** Mirrors DCBS. SUBP-005 reads this flag before enabling per-individual views; if `false`, the agreement is informational only and no individual records may be persisted. The intake form requires a default `true` only if the admin can attest to the agency's executed authorization.

3. **The `pre_release_window_days` field is binding.** SUBP-005 ingests only records with a projected release date inside `[today, today + pre_release_window_days]`, and the daily Inngest job deletes records that age out of the window without resulting in successful release-day handoff. Default is 60 days; admins may extend with explicit justification, but the validator rejects values < 30 (operationally too short to coordinate housing) or > 180 (operationally unjustified — a stale record at six months is risk without value).

4. **`no_recidivism_prediction_attestation` is non-optional.** The validator (`validateKyDocDsaTerms`) refuses to accept a terms object without `no_recidivism_prediction_attestation === true`. The intake form's submit button is disabled until the attestation checkbox is checked. There is no draft path that bypasses attestation. If a future use case requires an actuarial-scoring DSA (e.g., a separate research study), it gets a different agreement and a different ADR — do not weaken this validator.

5. **Audit every read.** Per § 4.3 of the template: every individual-record read of a pre-release record goes through `logAuditEvent` via the SUBP-005 access path. The audit table is the source of truth for the cooperation obligation in § 6.3 of the template.

6. **No re-disclosure to law enforcement, parole, or probation.** Coalition surfaces shall not provide pre-release records, derived analytics, or even confirmation-of-existence to law enforcement, parole, or probation authorities except under court order or written KY DOC authorization. Cross-domain joins that would correlate pre-release records with non-coalition surveillance data are blocked at the `dtrs/data-access.ts` policy gate. This is rule 6 because it is the most likely drift vector — well-intentioned data requests from sister agencies that would amount to re-purposing the data for surveillance.

### What does NOT change

- ADR 0006 (DCBS state-as-guardian) is unchanged. Foster youth continue to flow under the state's custodial authority, with `agency='dcbs'`. SUBP-005's gates do not consume DCBS DSAs.
- ADR 0007 (OASIS abuser-blind) is unchanged. DV survivor records continue to flow under the OASIS contract; KY DOC pre-release records are a distinct cohort with no overlap.
- The shared `partner_agreements` registry is unchanged structurally — KY DOC adds a third `agency` discriminator under the existing `kind='dsa'`, the same pattern DTRS-011 and DTRS-012 introduced.
- The generic OPRT-002 expiration watcher is unchanged — it watches all agreements regardless of kind/agency. KY DOC DSAs benefit automatically.

### Why this design and not alternatives

**Alternative A — separate `ky_doc_pre_release_records` table and a parallel KY-DOC-specific agreement-tracking table.** Rejected: re-litigates ADR 0004's "one agreement registry" decision, and worse, separates the policy (pre-release window, attestation) from the agreement that authorizes it. If the registry and the table drift, the policy enforcement drifts with them. SUBP-005's pre-release record table is a separate concern and does not require its own agreement registry.

**Alternative B — encode the pre-release window in `src/lib/dtrs/data-access.ts` as code, with the DSA being purely informational.** Rejected: the window is a *contractual* commitment. KY DOC needs to be able to point at a specific number in a signed instrument when their inspector general asks how long the Coalition retains pre-release records. Encoding it in `terms.pre_release_window_days` makes the agreement and the enforcement point the same artifact.

**Alternative C — make `no_recidivism_prediction_attestation` an optional advisory field.** Rejected: the prohibition against using reentry data for recidivism scoring is the contract's most consequential commitment. Making it optional creates a path where it gets dropped by accident. Strict validation here is a feature, not a limitation. If a research study ever wants to use anonymized reentry outcomes for recidivism modeling, it is a separate IRB-supervised activity outside this agreement.

**Alternative D — reuse the OASIS abuser-blind redaction-policy machinery for pre-release records.** Considered. The threat model is different enough that the redaction shape doesn't translate cleanly: there's no "abuser" adversary in the reentry context, and the fields that need protection are different (criminal history, prior placement, sentence length — none of which are in the abuser-blind redaction vocabulary). Reusing it would force concepts that don't fit. KY DOC gets its own narrow primitives: the window-bound, the attestation, and the no-LE-disclosure rule.

## Consequences

**What we get:**

- DTRS-013 ships a working KY DOC DSA workflow in 5 points: registry-extension, window-bounded ingest contract, attestation enforcement at the validator. Same shape as DTRS-011 / DTRS-012 — minimal new surface area.
- SUBP-005's pre-release ingest middleware reads `terms.pre_release_window_days` and `terms.individual_records_authorized` as its single source of truth. Changing either is a contract amendment with a new agreement row; the rendered template (`template_rendered`) preserves the legal artifact (ADR 0004 immutability).
- The OPRT-002 expiration watcher serves KY DOC for free. When an agreement's `end_date` lapses, all downstream gates fail closed automatically.
- Cross-cutting: `getActiveKyDocDsa(partnerOrgId)` is exposed via the dtrs barrel for any future SUBP-* reentry-adjacent stories (parole-supervision integration, expungement support — both out of scope for SUBP-005) to reuse the gate.
- Audit-on-read is the default, not an opt-in. SUBP-005's middleware is the only path to pre-release records, and the middleware always logs.

**What we don't get:**

- Per-individual consent variation. The KY DOC DSA covers all pre-release individuals KY DOC identifies as Daviess County residents within the window. Individual opt-outs are managed at KY DOC's intake / pre-release planning meeting, not in the Coalition's database. Coalition-side opt-outs are out of scope for Sprint 12.
- A redaction policy with the OASIS-shaped granularity. Pre-release records do not have a "current address" to suppress (the individual is in custody), so the OASIS redaction shape doesn't apply. Per-field redaction may become necessary if the cohort scope expands to include parole-supervision data; that's a future ADR.
- Real-time enforcement of the window across all already-ingested records. The Inngest delete job runs daily; between its runs there is a brief window where a record may be just past the configured window. This is acceptable for the Sprint 12 scope; if it becomes a problem (e.g., a DSA amendment shortens the window), we add an immediate sweep on agreement-status-change.
- Automatic enforcement of "no LE disclosure." Rule 6 is implemented as code review + boundary lint + the policy gate at `dtrs/data-access.ts`, not as a runtime LE-detection check. A future sprint may add a Sentry / log alert that fires when a pre-release record is read by an admin role outside the SUBP-005 caseworker surface.

**What we should watch for:**

1. **Drift between `terms.pre_release_window_days` and SUBP-005's ingest behavior.** This is the contract's most fragile point. Mitigations: (a) the middleware reads the value per-request, never caches; (b) add a contract test that exercises the window boundary at 0 / window-1 / window / window+1 days; (c) any code change to the middleware that touches the window logic requires reviewing the policy in this ADR.
2. **Templates becoming living documents.** Same concern as ADR 0004 / 0007: `template_rendered` is set once at signing and treated as immutable. The form does not expose an edit path on rows with `status='active'`. Editing the template-version goes through a new agreement row.
3. **Multiple active KY DOC DSAs for the same partner.** Pathological — only one should be active at a time. Don't enforce uniqueness at the DB (consistent with ADR 0004); let the form's "active-agreement warning" banner surface the conflict and let the admin supersede explicitly.
4. **Notification of breach to KY DOC.** § 4.4 of the template requires breach notification within 72 hours. There's no automated piping for this today (Sentry-only); a follow-up story should add a notification path that pages KY DOC's data steward when a breach event lands. Until then, ops must monitor Sentry for `dtrs.ky_doc.*` errors and notify manually.
5. **Pressure to integrate parole / probation.** Once the reentry pathway is working, sister agencies will ask "can you also share with us?" Rule 6 is the answer. Maintain it.

## Implementation checklist (DTRS-013 picks this up)

- [x] Lib: extend `src/lib/dtrs/partner-agreements.ts` with `KyDocDsaTerms`, `KY_DOC_DSA_SCOPE_OPTIONS`, `KY_DOC_PRE_RELEASE_WINDOW_DEFAULT_DAYS`, `KY_DOC_PRE_RELEASE_WINDOW_MIN_DAYS`, `KY_DOC_PRE_RELEASE_WINDOW_MAX_DAYS`, `validateKyDocDsaTerms`. Update `validateAgreementTerms` dispatcher to handle `agency==='ky_doc'`.
- [x] Parser: add `parseKyDocDsaAgreementForm` in `src/app/actions/partner-agreements-parse.ts` (sibling pure module per the `'use server'` × vitest quirk).
- [x] Action: add `recordKyDocDsaAgreementAction` in `src/app/actions/partner-agreements.ts`.
- [x] Query: add `getActiveKyDocDsa(partnerOrgId)` in `src/db/queries/partner-agreements.ts` using JSONB `terms->>'agency' = 'ky_doc'` filter.
- [x] Form component: `src/components/dtrs/kydoc-dsa-agreement-form.tsx` with pre-release-window selector + no-recidivism-prediction attestation checkbox.
- [x] Admin page: `src/app/app/admin/agreements/kydoc/page.tsx`.
- [x] Public template: `src/app/agreements/kydoc/template/page.tsx` (template version `kydoc-dsa-v1`).
- [x] Tests: validator tests in `src/lib/dtrs/partner-agreements.test.ts`; parser tests in `src/app/actions/partner-agreements.test.ts`.
- [ ] SUBP-005 picks this up in a follow-up PR — its ingest middleware reads `getActiveKyDocDsa()` and `terms.pre_release_window_days`.
