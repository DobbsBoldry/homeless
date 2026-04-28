# ADR 0006 — DCBS data-sharing privacy contract (individual-record under guardian authority)

**Status:** Accepted — 2026-04-28
**Driver:** Sprint 10. DTRS-011 ([#141](https://github.com/DobbsBoldry/homeless/issues/141)) introduces the first inbound flow that carries individually identifying records about minors *with state custody as the legal basis* — different from FERPA (parental consent → first-initial only, ADR 0005), and different from faith-aggregate (identification-impossible by structure, ADR 0003). The DCBS DSA must be specified before SUBP-001 (foster aging-out countdown) ingests any youth records.

## Context

Sprint 9 closed the schools entry: PRVN-003 (school-referral receiver) operates under a FERPA-fork consent model where parental consent is *not* sought for the McKinney-Vento exception, so the receiver only persists `student_first_initial` plus partner-side identifiers — never DOB, never last name. That worked because federal McKinney-Vento authority narrowly authorizes minimum-necessary disclosure to housing-service providers without parental consent.

Sprint 10 starts the DCBS / foster-aging-out pathway. The use case demands more:

- **SUBP-001** computes "days until 18th birthday" per youth and fires alerts at 90/60/30/14/7-day milestones. *Day-precision DOB is required.*
- **SUBP-002** pre-fills the TEAMKY Former Foster Youth Medicaid extension application — full legal name, DCBS case number, eligibility detail.
- **Caseworker coordination** with the assigned DCBS worker happens at individual-youth granularity ("how is Aaron doing on housing? has Devyn filed Medicaid yet?").

These are individual-record flows. The platform has not done that for minors before.

The legal regime is materially different from FERPA:

| | FERPA (ADR 0005) | DCBS DSA (this ADR) |
|---|---|---|
| Consenter | Parent or eligible student (18+) | The state, as legal guardian under KRS 620.140 |
| Default rule | Forbidden without consent | Authorized to share with service providers acting on the agency's behalf |
| Identifiable data | Forbidden under directory rule unless McKinney-Vento exception narrowly applies | Authorized when the DSA is in force and `individual_records_authorized=true` |
| Retention | Per FERPA studies-exception (§ 99.31(a)(6)): destroy when no longer needed | Per Cabinet data-handling standards; configurable: on_termination / 3yr / 5yr |
| Audit obligation | District-side § 99.32 disclosure log; coalition-side audit log | Coalition-side audit log + cooperation with DCBS audits |

The structural difference: in foster care, *the state is the legal guardian.* When DCBS executes a DSA authorizing the coalition to receive identifying records on behalf of youth in custody, that is not a workaround — it is the agency exercising its custodial authority on the youth's behalf, in the same way a parent does for a minor not in foster care. The privacy contract has to be designed around that fact, not against it.

## Decision

**Use the existing `partner_agreements` registry (ADR 0004) with `kind='dsa'` and a structured `agency='dcbs'` discriminator on the JSONB terms shape.** Persist individual youth records (DOB, legal name, DCBS case number) under the gate of an active DCBS DSA whose `individual_records_authorized` flag is `true`. Treat the DSA as the runtime feature flag for individual-record ingest in SUBP-001/002.

### Privacy contract — five rules

1. **No individual youth record may be persisted without an active DCBS DSA.** SUBP-001's ingest path reads `getActiveAgreementByKind(dcbsPartnerOrgId, 'dsa')` before every write batch and fails closed if no active agreement exists. Same gate applies on every read for reporting.

2. **`individual_records_authorized` is the on/off switch.** Even with an active DSA, if the flag is `false`, the coalition treats the agreement as informational/aggregate-only and does *not* persist DOB or other PII. (Sprint 10 forms default to `true`; the field exists for future restricted DSAs.)

3. **Never re-disclose to non-DSA partners.** The `dtrs/data-access.ts` policy gate must block reads of foster-youth records by viewers whose role is not in `{admin, dcbs_caseworker, coalition_caseworker}`. Cross-partner reads (e.g. a faith ministry asking about a specific youth) are denied at policy regardless of the requesting partner's separate agreements.

4. **Audit every read.** Per § 4.3 of the template: every individual-record read is audit-logged via `logAuditEvent`. The audit table is the source of truth for the cooperation obligation in § 6.3 of the template (DCBS may request a trail).

5. **Population focus is locked at the schema layer.** `population_focus` is currently constrained to `'foster_aging_out'` only (other values throw in the validator). Expanding to additional DCBS populations — youth with active dependency cases, kinship placements, etc. — requires (a) a written amendment to the DSA, and (b) an explicit code change to widen the validator. Schema-level lock prevents accidental scope creep.

### What does NOT change

- ADR 0003 (faith-aggregate privacy contract) is unchanged. Faith partners remain aggregate-only with structural impossibility of identification. DCBS is a different relationship; identifiability is permitted because the legal basis is different.
- ADR 0005 (FERPA fork) is unchanged. Schools remain on the McKinney-Vento exception with `student_first_initial` only. DCBS is a separate regime, separate registry kind, separate scope vocabulary.

### Why this design and not alternatives

**Alternative A — separate `dcbs_youth_records` table outside the partner-agreements registry.** Rejected: re-litigates ADR 0004's "one agreement registry" decision and creates a parallel agreement-tracking surface. The agreement is the agreement; only the *data flowing under it* differs.

**Alternative B — store full PII in DCBS DSA terms JSONB, retrieve at runtime.** Rejected: terms is for the agreement's *structured commitments*, not for case data. Case data goes in a separate domain table (foster_youth, owned by `subp` domain) gated by the DSA.

**Alternative C — fork a third privacy regime for DCBS like ADR 0005 did for FERPA.** Considered. The FERPA fork was structurally necessary because the consent surface (one consent record per subject) doesn't model FERPA's "parent consents on behalf of minor" + McKinney-Vento exception layering. DCBS doesn't need a fork: there is no consent surface here, just a state-guardian DSA. The agreement registry already accommodates this.

## Consequences

- SUBP-001's first migration adds `foster_youth` table in the `subp` domain. Reads/writes gate on `getActiveAgreementByKind(..., 'dsa')`. Synthetic-only fixtures during pilot (PHI fence in CLAUDE.md still applies; switch to real data is a later-sprint decision when DCBS BAA + technical integration are both ready).
- The audit log is now load-bearing for compliance with the template's § 6.3 cooperation clause. Don't disable audit-logging on individual-record reads, even temporarily for tests.
- Future DSAs (KY DOC under DTRS-012, others) will reuse the `kind='dsa'` shape with their own `agency` value. The validator dispatcher already routes on `agency`; adding KY DOC means adding a `validateKyDocDsaTerms` function and an `agency: 'ky_doc'` arm to the `DsaTerms` union.
- If the DSA is revoked or expires, ingest stops and existing youth records enter the destruction window per § 5 of the executed agreement. The destruction workflow itself is **not** automated by Sprint 10 — manual operations procedure documented separately. Tracked as a follow-up.

## References

- [ADR 0001](0001-modular-monolith.md) — modular monolith, neutral data steward
- [ADR 0003](0003-faith-aggregate-privacy-contract.md) — privacy by structural impossibility (faith)
- [ADR 0004](0004-partner-agreements-registry.md) — one agreement table, multiple kinds
- [ADR 0005](0005-ferpa-student-referral-consent.md) — FERPA fork for student referrals
- John H. Chafee Foster Care Program, 42 U.S.C. § 677
- Family First Prevention Services Act, Pub. L. 115-123
- KRS Chapter 620 — Kentucky dependency, neglect, and abuse
- 42 U.S.C. § 1396a(a)(10)(A)(i)(IX) — Former Foster Youth Medicaid extension to age 26
