# ADR 0005 — FERPA consent model for student-referral data

**Status:** Accepted — 2026-04-28
**Driver:** Sprint 9 pre-flight. PRVN-003 (McKinney-Vento liaison referral receiver, [#125](https://github.com/DobbsBoldry/homeless/issues/125)) introduces the first inbound flow carrying minor-student identifying data. FERPA, not HIPAA, is the governing regime — and the existing dtrs consent infrastructure was built for HIPAA-shaped flows. Decide upfront whether to extend or fork.

## Context

The existing consent surface (`consents` table, `dtrs/consent-text.ts`, `/p/[ref]/consent/grant` flow) was designed for the post-BAA HIPAA flow:

- Adult patient grants consent for cross-coalition data sharing
- One consent record per (subject, type, partner-scope)
- Versioned text via `CURRENT_CONSENT_VERSION`
- Token-bearer access via `consent_access_tokens`

FERPA's regime for student records is different:

| | HIPAA (current dtrs surface) | FERPA (new for PRVN-003) |
|---|---|---|
| Who consents | The data subject themselves | Parent/guardian (under 18) or eligible student (18+) |
| Default disclosure rule | Forbidden without authorization | Forbidden without consent **except** for "directory information" (name, address, attendance dates) which can be disclosed unless parents opt out |
| Special exceptions | Treatment, payment, operations | Studies exception (school can share for research aligned with educational interests); School Officials exception; Health/safety emergency |
| McKinney-Vento twist | n/a | Liaisons may share *minimum-necessary* information with service providers without parental consent when the disclosure is to "facilitate access to housing or related services" — explicitly authorized by the McKinney-Vento Homeless Assistance Act |
| Data minor | n/a | Yes — separate child-protection considerations |
| Audit-log expectation | Per-access auditing for PHI | Annual disclosure log accessible to parents on request (FERPA § 99.32) |

The McKinney-Vento authorization is the load-bearing piece for Sprint 9: it means a school liaison can refer a homeless student's family to coalition services *without parental consent*, as long as the referral is for housing-related services. That's a narrow exception, not a general one.

## Decision

**Fork the consent surface, don't extend.** Build a separate `school_referral_consents` (and a separate consent-text version line) rather than reusing the existing `consents` table. The two regimes have enough divergence — different consenters, different default rules, different exception frameworks, different audit-log obligations — that conflating them would force every read query to disambiguate "is this a HIPAA consent or a FERPA consent?" in code.

### What "fork" looks like

**Three new tables:**

```sql
-- The legal-basis row: every school referral records WHY it was authorized to flow
CREATE TYPE school_referral_basis AS ENUM (
  'mckinney_vento_authorization',  -- the liaison invoked the M-V act exception
  'parental_consent',              -- parent/guardian explicitly consented to share
  'eligible_student_consent',      -- student 18+ consented
  'directory_info_only',           -- disclosure limited to FERPA directory info
  'health_safety_emergency'        -- FERPA § 99.31(a)(10) — narrow, time-bound
);

CREATE TABLE school_referrals (...);  -- the actual referral data — see PRVN-003

CREATE TABLE school_referral_consents (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  referral_id uuid NOT NULL REFERENCES school_referrals(id) ON DELETE CASCADE,
  basis school_referral_basis NOT NULL,
  consenter_relationship text,                -- 'parent', 'guardian', 'self' (eligible student)
  consenter_name text,                        -- redacted in non-admin views
  consent_text_version text NOT NULL,         -- e.g. 'ferpa-parental-v1'
  signed_at timestamptz,                      -- null when basis is m-v authorization (no consent collected)
  signed_method text,                         -- 'in_person', 'web_form', 'phone'
  scope jsonb NOT NULL DEFAULT '{}'::jsonb,    -- which data classes, which partners, which time window
  expires_at timestamptz,
  revoked_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);

-- Annual disclosure log — FERPA § 99.32 requires this for non-directory-info
-- disclosures. One row per access; surfaced to the parent on request.
CREATE TABLE school_referral_disclosures (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  referral_id uuid NOT NULL REFERENCES school_referrals(id) ON DELETE CASCADE,
  accessed_by_user_id uuid REFERENCES users(id),
  accessed_by_partner_org_id uuid REFERENCES partner_orgs(id),
  purpose text NOT NULL,                      -- structured purpose string
  basis school_referral_basis NOT NULL,       -- which authorization permitted this access
  accessed_at timestamptz NOT NULL DEFAULT now(),
  data_classes_disclosed jsonb NOT NULL DEFAULT '[]'::jsonb
);
```

**Consent text:** new versioned strings under `src/lib/dtrs/ferpa-consent-text.ts`. Sibling to `consent-text.ts`. Each version corresponds to one regulatory shape (parental consent, eligible-student consent). The McKinney-Vento authorization basis carries no consent text — it's a statutory authorization, not a consent record.

**Domain logic** in `src/lib/dtrs/school-referral-policy.ts` (new, FERPA-specific):

- `canAccessSchoolReferral(viewer, referral) → { allow: boolean, basis, requireDisclosureLog }` — the policy gate. Always logs to `school_referral_disclosures` when `allow=true` and the referral isn't directory-info-only.
- `validateMcKinneyVentoBasis(referral)` — sanity check that the referral payload is consistent with M-V authorization (e.g. student must be flagged homeless; service routing must be housing-related).

### What we do NOT change

- The existing `consents` table, `dtrs/consent.ts`, `dtrs/consent-text.ts`, `consent-form.tsx`, and `/p/[ref]/consent/grant` surface — all stay as-is. They remain the HIPAA-shaped consent path for adult coalition clients.
- The `audit_log` table — both regimes use it. FERPA disclosures additionally land in `school_referral_disclosures` (FERPA-specific obligation; audit_log is the cross-system record).
- ADR 0001 boundaries — schools work lives in `dtrs` (privacy-critical) with `prvn` consuming. No new domain.

## Consequences

**What we get:**

- Each regime gets its own data model, audit obligation, and consent vocabulary. Reading a referral's authorization story is one table lookup, not a discriminated union scan.
- McKinney-Vento authorization is a first-class basis — not shoved into a "type=other" bucket. The narrowness of the exception is structurally honored.
- FERPA's annual disclosure log is built in from day one, not bolted on later when a parent requests their child's record.
- Future privacy-distinct regimes (DCBS foster-care confidentiality under KY KRS Chapter 620, KY DOC reentry data under 42 CFR Part 2) follow the same fork pattern — each gets its own consent table.

**What we don't get:**

- A single "show me everyone who has consent for X" query. We accept this — FERPA and HIPAA consents aren't comparable; aggregating them produces a wrong-shaped answer.
- Code-reuse of the consent-form component. The `<ConsentForm>` in `src/components/consent/` is HIPAA-shaped. Sprint 9's school-referral form will be its own component (`<SchoolReferralForm>`) — same shadcn primitives, different vocabulary and validation. ~80% of the React is duplicated. Acceptable cost; over-abstracting consent UX has bitten teams before.

**What we should watch for:**

1. **Mistaking M-V authorization for general consent.** If a service provider downstream of the coalition wants to forward a school referral to *another* provider, M-V authorization doesn't automatically extend. The disclosure-log row should make this visible — every onward access requires its own basis check.
2. **Directory-info disclosures still get logged.** FERPA technically allows directory info without parental consent and without a disclosure-log row, *but* parents can opt out of directory disclosure entirely. Safer pattern: log every access regardless of basis; suppress the row from the parent-facing report only if the basis is `directory_info_only` and no opt-out is on file.
3. **18th-birthday eligibility flip.** A student under 18 has parents as the consent-holder; on their 18th birthday they become "eligible students" and consent transfers to them. SUBP-001 (foster aging-out countdown engine) already deals with this concept — we should align the date-flip logic when SUBP-001 ships.

## Implementation checklist (PRVN-003 picks this up)

- [ ] Migration `0036_PRVN-003_school_referrals.sql` — three tables + enum.
- [ ] Drizzle schema in `src/db/schema/school-referrals.ts` + corresponding consent/disclosure schema files.
- [ ] `src/lib/dtrs/ferpa-consent-text.ts` — versioned consent text strings.
- [ ] `src/lib/dtrs/school-referral-policy.ts` — `canAccessSchoolReferral`, `validateMcKinneyVentoBasis`, disclosure-log writers.
- [ ] `src/db/queries/school-referrals.ts` — CRUD with the policy gate.
- [ ] Liaison-facing referral form — admin-style page under `/app/app/partner/school-referral/intake/page.tsx` (or similar; auth via partner-org membership).
- [ ] At least one happy-path test exercising M-V authorization basis end-to-end.

COOR-014 (closed-loop confirmation) and PRVN-004 (aggregate reporting) read from these tables but don't extend the consent surface — they inherit the policy gate.
