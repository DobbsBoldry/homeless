# ADR 0010 — VA HUD-VASH data-sharing privacy contract (clinical context, voucher window, no service-denial prediction)

**Status:** Accepted — 2026-05-04
**Driver:** Sprint 13. DTRS-015 ([#379](https://github.com/DobbsBoldry/homeless/issues/379)) introduces the inbound flow for the U.S. Department of Veterans Affairs HUD-VASH program (HUD-Veterans Affairs Supportive Housing) to support SUBP-006 (Veteran pathway, [#135](https://github.com/DobbsBoldry/homeless/issues/135)). The veteran use case is the fourth state-or-federally-authorized data-sharing relationship after DCBS (ADR 0006), OASIS (ADR 0007), and KY DOC (ADR 0009). It needs its own privacy contract because the cohort, the threat model, and the statutory regime differ from all three.

## Context

Sprint 12 closed the reentry entry under ADR 0009 (KY DOC, state-as-custodian during incarceration, narrow pre-release window, no recidivism prediction). Sprint 13 starts the veteran entry, which is structurally distinct from KY DOC in three important ways:

| | KY DOC (ADR 0009) | VA HUD-VASH (this ADR) |
|---|---|---|
| Cohort | Incarcerated people approaching release | Veterans engaged with HUD-VASH (eligible / vouchered / leasing / leased) |
| Custodial authority | The state, as custodian during incarceration (KRS Chapter 197) | The veteran themselves (voluntary HUD-VASH enrollment + ROI under 38 CFR § 1.526 / § 17.41) plus the VA as covered entity for clinical data |
| Threat model | (a) stigma-driven housing/employment denial; (b) misuse for recidivism prediction; (c) re-identification by parole / law-enforcement secondary use | (a) MH/SUD diagnosis stigma → employer / landlord / insurer denial; (b) misuse for **service-denial prediction** (e.g., "this veteran will fail the voucher, deprioritize"); (c) re-identification by VA OIG / external benefits fraud reviewers |
| Default rule | Authorized to share narrow pre-release fields under DOC DSA | Authorized to share voucher-status + service-coordination fields under joint VA / local PHA DSA; **no service-denial inference, no insurer-bound disclosure** |
| Cohort scale | Tens to low hundreds of pre-release individuals | Tens of veterans actively in HUD-VASH (Daviess County: ~25-50 active vouchers across the local PHA's allocation) |
| Statutory regime | KRS Chapter 197, KRS Chapter 439, federal Second Chance Act (42 U.S.C. § 17501 et seq.) | **38 U.S.C. § 7332** (confidentiality of MH/SUD records — stricter than HIPAA), **38 CFR Part 1** (VA records confidentiality), **42 U.S.C. § 290dd-2** (federal SUD records — Part 2), **42 U.S.C. § 11403** (HUD-VASH authorization), HIPAA (45 CFR Part 164) |
| Re-disclosure | Forbidden without KY DOC authorization; **explicit prohibition on disclosure to law enforcement, parole, or probation absent court order** | Forbidden without VA authorization; **explicit prohibition on disclosure to insurers, employer background-check vendors, or any party for service-denial determinations**; 38 U.S.C. § 7332 + 42 U.S.C. § 290dd-2 layer additional re-disclosure restrictions on MH/SUD content |
| Window of receipt | **Bounded** — pre-release window (default 60 days) before projected release, plus a short tail post-release | **Bounded by voucher lifecycle** — from voucher issuance through the active housing-search and lease-stabilization period (default 120 days, matching HUD's standard voucher term plus typical extension) |
| Audit obligation | Coalition-side audit log + KY DOC audit cooperation; breach → KY DOC notification within 72 hours | **Coalition-side audit log on every read**, joint VA + PHA audit cooperation, breach → mandatory VA Privacy Officer notification within 72 hours and HUD field-office notification within 5 business days |

**Why a voucher window matters.** HUD-VASH operates on a clock: HUD's standard housing-choice voucher gives the veteran 60 days to find housing, with a 60-day extension at PHA discretion. After lease-up, the coalition's coordination role is to support stabilization (typically 90 days post-lease) before transitioning to standard VA case management. Records older than the active coordination window add nothing operationally — VA case managers continue their work directly with the veteran — and add risk (stale clinical data, drift between voucher status and lease status, increased blast radius). The contract therefore makes the window a structural property of the data flow: VA shares only records inside the window, the Coalition deletes records that age out, and the runtime gate enforces both directions. Default of 120 days covers issuance + standard search + extension; admin may extend with explicit justification, but the validator rejects values < 60 (operationally too short — HUD's minimum voucher term is 60 days) or > 240 (operationally unjustified — at 8 months the veteran is either housed and stable or has lost the voucher).

**Why "no service-denial prediction" is in the contract.** HUD-VASH support is fundamentally different from triage. The Coalition's purpose is to help every veteran with a voucher succeed at lease-up by lining up landlords, application support, and ancillary benefits. It is *not* to predict which veterans will fail the voucher and deprioritize their cases. The contract makes this explicit because the same data (voucher status, MH/SUD continuity, service-connection rating, prior-housing history) could in principle be repurposed for actuarial scoring of "voucher-failure risk" — and there is a documented pattern of well-intentioned housing tools drifting in that direction once the data is in hand, with the result of deprioritizing exactly the veterans who need the most support. Encoding the prohibition in the agreement, not just the policy, makes drift a contractual breach rather than a code-review failure.

**Why MH/SUD content is treated specially.** 38 U.S.C. § 7332 and 42 U.S.C. § 290dd-2 (Part 2) impose stricter re-disclosure rules on mental-health and substance-use records than ordinary HIPAA. The contract treats `treatment_continuity` as the *fact* of an active treatment relationship (shareable) but not the diagnosis, treatment plan, or session content (out of scope). SUBP-006's surfaces never receive 7332/Part 2 protected content; the VA case manager retains it. The DSA codifies this scope boundary so that an inadvertent expansion is a contract breach.

The platform already has the registry infrastructure ([ADR 0004 modular monolith / partner_agreements](./0004-modular-monolith.md)), the per-partner-org agreement-recording pattern ([DTRS-010 FERPA #359](https://github.com/DobbsBoldry/homeless/pull/359), [DTRS-011 DCBS #364](https://github.com/DobbsBoldry/homeless/pull/364), [DTRS-012 OASIS #370](https://github.com/DobbsBoldry/homeless/pull/370), [DTRS-013 KY DOC #376](https://github.com/DobbsBoldry/homeless/pull/376)), and the generic expiration watcher ([OPRT-002 #368](https://github.com/DobbsBoldry/homeless/pull/368)). The question this ADR answers is: where does the veteran-specific privacy contract live, and what is the source of truth for SUBP-006's runtime gates?

## Decision

**Use the existing `partner_agreements` registry (ADR 0004) with `kind='dsa'` and `agency='va_hudvash'`. Encode the veteran-specific contract — voucher-search window length, individual-records authorization, no-service-denial-prediction acknowledgement, MH/SUD scope boundary, and population focus — as structured fields on the JSONB `terms`. Treat the agreement's stored terms as the contract-of-record for SUBP-006's veteran gates.** Persist any veteran roster record under the gate of an active VA HUD-VASH DSA whose `individual_records_authorized` flag is `true` and whose `voucher_search_window_days` covers the record's voucher horizon.

### Privacy contract — six rules

1. **No veteran record may be persisted without an active VA HUD-VASH DSA.** SUBP-006's ingest path reads `getActiveVaHudVashDsa(vaPartnerOrgId)` before every write batch and fails closed if no active agreement exists. Same gate applies on every read for reporting. Per ADR 0004 § 3.1.

2. **`individual_records_authorized` is the runtime authorization gate.** Mirrors DCBS / KY DOC. SUBP-006 reads this flag before enabling per-individual views; if `false`, the agreement is informational only and no individual records may be persisted. The intake form requires a default `true` only if the admin can attest to the joint VA + local PHA executed authorization.

3. **The `voucher_search_window_days` field is binding.** SUBP-006 ingests only records whose voucher-issuance date plus the window covers `today`, and the daily Inngest job deletes records that age out without resulting in a successful lease-up handoff. Default is 120 days; admins may extend with explicit justification, but the validator rejects values < 60 (HUD's operational minimum) or > 240 (operationally unjustified — stale at 8 months).

4. **`no_service_denial_prediction_attestation` is non-optional.** The validator (`validateVaHudVashDsaTerms`) refuses to accept a terms object without `no_service_denial_prediction_attestation === true`. The intake form's submit button is disabled until the attestation checkbox is checked. There is no draft path that bypasses attestation. If a future use case requires triage-style scoring (e.g., a HUD-funded research evaluation), it gets a different agreement and a different ADR — do not weaken this validator.

5. **Audit every read.** Per § 4.3 of the template: every individual-record read of a veteran record goes through `logAuditEvent` via the SUBP-006 access path. The audit table is the source of truth for the cooperation obligation in § 6.3 of the template.

6. **No re-disclosure to insurers, employment-screening vendors, or for service-denial determinations.** Coalition surfaces shall not provide veteran records, derived analytics, or even confirmation-of-existence to insurance carriers, employer background-check vendors, or any party requesting data for the purpose of denying or limiting services to the veteran. Cross-domain joins that would correlate veteran records with non-coalition surveillance, claims, or background-check data are blocked at the `dtrs/data-access.ts` policy gate. This is rule 6 because it is the most likely drift vector — well-intentioned data requests from sister programs that would amount to re-purposing the data for service-eligibility scoring.

### MH/SUD scope boundary

Beyond the six rules, the DSA explicitly bounds the MH/SUD content the Coalition may receive:

- **Permitted:** the *fact* of an active treatment relationship (boolean flag), continuity status (`in_place` / `at_risk` / `lapsed`), and the VA case manager's contact info for warm handoff.
- **Forbidden:** diagnosis codes, treatment plan content, session notes, medication lists, lab results, or any other 38 U.S.C. § 7332 or 42 U.S.C. § 290dd-2 protected content.

This boundary is encoded in the `treatment_scope` enum on `VaHudVashDsaTerms` (`status_only` is the only permitted value at v1; future amendments would require a new ADR, IRB-equivalent VA Privacy Office review, and a separate Qualified Service Organization Agreement under 42 CFR Part 2).

### What does NOT change

- ADR 0006 (DCBS state-as-guardian) is unchanged. Foster youth continue to flow under the state's custodial authority, with `agency='dcbs'`. SUBP-006's gates do not consume DCBS DSAs.
- ADR 0007 (OASIS abuser-blind) is unchanged.
- ADR 0009 (KY DOC reentry) is unchanged. Reentry pre-release records and veteran records are distinct cohorts; veterans returning from incarceration who are eligible for HUD-VASH would be covered by both DSAs simultaneously, with the more restrictive privacy treatment applying to any field present in both.
- The shared `partner_agreements` registry is unchanged structurally — VA HUD-VASH adds a fourth `agency` discriminator under the existing `kind='dsa'`, the same pattern DTRS-011 / DTRS-012 / DTRS-013 introduced.
- The generic OPRT-002 expiration watcher is unchanged — it watches all agreements regardless of kind/agency. VA HUD-VASH DSAs benefit automatically.

### Why this design and not alternatives

**Alternative A — separate `va_hudvash_records` table and a parallel VA-specific agreement-tracking table.** Rejected: re-litigates ADR 0004's "one agreement registry" decision and separates the policy (voucher window, attestations, MH/SUD scope) from the agreement that authorizes it. SUBP-006's veteran record table is a separate concern and does not require its own agreement registry.

**Alternative B — encode the voucher window in `src/lib/dtrs/data-access.ts` as code, with the DSA being purely informational.** Rejected: the window is a *contractual* commitment. The VA Privacy Office and the local PHA need to be able to point at a specific number in a signed instrument. Encoding it in `terms.voucher_search_window_days` makes the agreement and the enforcement point the same artifact.

**Alternative C — make `no_service_denial_prediction_attestation` an optional advisory field.** Rejected: the prohibition against using veteran data for service-denial scoring is the contract's most consequential commitment. Making it optional creates a path where it gets dropped by accident. Strict validation here is a feature, not a limitation.

**Alternative D — allow MH/SUD diagnosis content under a Qualified Service Organization Agreement (QSOA).** Considered. Adding QSOA-protected content would unlock richer triage but would also require a separate agreement type (QSOA per 42 CFR Part 2 § 2.11), additional Coalition-side personnel-training requirements, and a redaction-policy machinery similar to ADR 0007. Out of scope for Sprint 13 — when the VA / local QSOA is needed, that gets its own ADR and agreement kind (`kind='qsoa'`, currently a placeholder in the registry).

**Alternative E — reuse the OASIS abuser-blind redaction-policy machinery for MH/SUD content.** Considered. The threat model is different enough that the redaction shape doesn't translate cleanly: in OASIS the adversary is a known third party (the abuser); in HUD-VASH the adversaries are diffuse (insurers, employers, eligibility-screening systems). Redaction by field-suppression is the right answer for OASIS; bounded *scope* (status_only) is the right answer for VA HUD-VASH. Reusing OASIS would force concepts that don't fit.

## Consequences

**What we get:**

- DTRS-015 ships a working VA HUD-VASH DSA workflow in 5 points: registry-extension, voucher-window-bounded ingest contract, attestation enforcement at the validator, MH/SUD scope boundary at the type level. Same shape as DTRS-011 / DTRS-012 / DTRS-013 — minimal new surface area.
- SUBP-006's veteran ingest middleware reads `terms.voucher_search_window_days` and `terms.individual_records_authorized` as its single source of truth. Changing either is a contract amendment with a new agreement row; the rendered template (`template_rendered`) preserves the legal artifact (ADR 0004 immutability).
- The OPRT-002 expiration watcher serves VA HUD-VASH for free.
- Cross-cutting: `getActiveVaHudVashDsa(partnerOrgId)` is exposed via the dtrs barrel for any future SUBP-* veteran-adjacent stories (Veterans Treatment Court coordination, HCHV grant tracking, SSVF outreach — all out of scope for SUBP-006) to reuse the gate.
- Audit-on-read is the default, not an opt-in. SUBP-006's middleware is the only path to veteran records, and the middleware always logs.

**What we don't get:**

- MH/SUD diagnosis content. Out of scope at v1; requires a separate QSOA + ADR.
- Per-individual consent variation. The DSA covers all veterans the local PHA + VA identifies as actively engaged with HUD-VASH within the window. Individual opt-outs are managed at VA / PHA intake, not in the Coalition's database. Coalition-side opt-outs are out of scope for Sprint 13.
- Real-time enforcement of the window across all already-ingested records. The Inngest delete job runs daily; between its runs there is a brief window where a record may be just past the configured window. This is acceptable for the Sprint 13 scope.
- Automatic enforcement of "no insurer / employer disclosure." Rule 6 is implemented as code review + boundary lint + the policy gate at `dtrs/data-access.ts`, not as a runtime detection check. A future sprint may add a Sentry / log alert.

**What we should watch for:**

1. **Drift between `terms.voucher_search_window_days` and SUBP-006's ingest behavior.** This is the contract's most fragile point. Mitigations: (a) the middleware reads the value per-request, never caches; (b) add a contract test that exercises the window boundary at 0 / window-1 / window / window+1 days; (c) any code change to the middleware that touches the window logic requires reviewing the policy in this ADR.
2. **Templates becoming living documents.** Same concern as ADR 0004 / 0007 / 0009: `template_rendered` is set once at signing and treated as immutable.
3. **Multiple active VA HUD-VASH DSAs for the same partner.** Pathological — only one should be active at a time. Don't enforce uniqueness at the DB; let the form's "active-agreement warning" banner surface the conflict.
4. **Notification of breach to VA + HUD.** § 4.4 of the template requires VA Privacy Office notification within 72 hours and HUD field-office notification within 5 business days. There's no automated piping for this today (Sentry-only); a follow-up story should add a notification path.
5. **Pressure to expand MH/SUD scope.** Once the veteran pathway is working, sister programs will ask "can you also share treatment plans?" The MH/SUD scope boundary is the answer. Maintain it; expansion requires a new ADR + QSOA.
6. **Joint authorization complexity.** Unlike DCBS (single state agency), VA HUD-VASH involves both the VA Medical Center / VAMC HUD-VASH team and the local Public Housing Authority that holds the voucher allocation. The agreement template requires both signatories. A change in either party's leadership or program structure may require a new agreement.

## Implementation checklist (DTRS-015 picks this up)

- [ ] Lib: extend `src/lib/dtrs/partner-agreements.ts` with `VaHudVashDsaTerms`, `VA_HUDVASH_DSA_SCOPE_OPTIONS`, `VA_HUDVASH_VOUCHER_WINDOW_DEFAULT_DAYS`, `VA_HUDVASH_VOUCHER_WINDOW_MIN_DAYS`, `VA_HUDVASH_VOUCHER_WINDOW_MAX_DAYS`, `validateVaHudVashDsaTerms`. Update `validateAgreementTerms` dispatcher to handle `agency==='va_hudvash'`.
- [ ] Parser: add `parseVaHudVashDsaAgreementForm` in `src/app/actions/partner-agreements-parse.ts`.
- [ ] Action: add `recordVaHudVashDsaAgreementAction` in `src/app/actions/partner-agreements.ts`.
- [ ] Query: add `getActiveVaHudVashDsa(partnerOrgId)` in `src/db/queries/partner-agreements.ts` using JSONB `terms->>'agency' = 'va_hudvash'` filter.
- [ ] Form component: `src/components/dtrs/vahudvash-dsa-agreement-form.tsx` with voucher-window selector + no-service-denial-prediction attestation checkbox.
- [ ] Admin page: `src/app/app/admin/agreements/vahudvash/page.tsx`.
- [ ] Public template: `src/app/agreements/vahudvash/template/page.tsx` (template version `vahudvash-dsa-v1`).
- [ ] Tests: validator tests in `src/lib/dtrs/partner-agreements.test.ts`; parser tests in `src/app/actions/partner-agreements.test.ts`.
- [ ] SUBP-006 picks this up in a follow-up PR — its veteran ingest middleware reads `getActiveVaHudVashDsa()` and `terms.voucher_search_window_days`.
