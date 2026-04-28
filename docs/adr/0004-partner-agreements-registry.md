# ADR 0004 — Partner-agreements registry (one table, multiple agreement kinds)

**Status:** Accepted — 2026-04-28
**Driver:** Sprint 9 pre-flight. DTRS-010 (FERPA agreement template + intake) and OPRT-002 (MOU registry) overlap structurally — both are "we have a signed agreement with this partner; here are its terms and dates." Decide once whether they share a table or each gets its own.

## Context

Sprint 8 shipped the faith-aggregate flow under DTRS-007/008/009. Sprint 9 starts schools, which requires a FERPA-compliant data-sharing agreement per `strategy/data.html` § 4. Separately, [#12 OPRT-002](https://github.com/DobbsBoldry/homeless/issues/12) has been open since Sprint 0 — a generic MOU registry for any partner-org.

Both features answer the same question: *"What's the current legal basis for our data flow with this partner?"*

- **DTRS-010** wants: FERPA agreement effective dates, signed-by names, scope (which data classes), the rendered template the district reviewed, and a way for an admin to mark it active/expired.
- **OPRT-002** wants: MOU effective dates, signed-by names, the kitchen-cabinet commitments, withdrawal terms, and a way to track which partners have an active MOU.

Other agreement kinds will follow:

- **BAA** (Business Associate Agreement) for Owensboro Health post-ESUC-001/002
- **QSOA** (Qualified Service Organization Agreement) for substance-use-treatment partners under 42 CFR Part 2
- **DSA** (Data-Sharing Agreement) for DCBS, KY DOC (DTRS-011, -012)
- **Parental consent** for individual-level student data (separate from FERPA's institutional agreement — see ADR 0005)

If we build a separate table per kind we end up with 4–6 nearly-identical tables differing only in their kind-specific JSON payload. That fights against the "neutral steward" principle from ADR 0001 and the "one source of truth" instinct from `data.html`.

## Decision

**One table: `partner_agreements`.** A polymorphic registry with an `agreement_kind` enum and a JSONB `terms` column for kind-specific structured data. Each row is *the agreement* — the rendered template, the effective dates, the signed-by metadata, and the kind-specific terms.

### Schema

```sql
CREATE TYPE partner_agreement_kind AS ENUM (
  'mou',          -- generic Phase 0 MOU (OPRT-002)
  'ferpa',        -- school-district FERPA agreement (DTRS-010)
  'baa',          -- HIPAA Business Associate Agreement (post ESUC-001/002)
  'qsoa',         -- 42 CFR Part 2 Qualified Service Organization Agreement
  'dsa',          -- generic state/agency Data-Sharing Agreement (DTRS-011/012)
  'memo_of_cooperation'  -- non-HMIS faith-partner agreement (per data.html § 6)
);

CREATE TYPE partner_agreement_status AS ENUM (
  'draft',        -- being negotiated, no force yet
  'active',       -- signed and in force
  'expired',      -- past end_date and not renewed
  'terminated',   -- ended early per withdrawal clause
  'superseded'    -- replaced by a newer agreement (status flips when next active row covers same scope)
);

CREATE TABLE partner_agreements (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  partner_org_id uuid NOT NULL REFERENCES partner_orgs(id) ON DELETE RESTRICT,
  kind partner_agreement_kind NOT NULL,
  status partner_agreement_status NOT NULL DEFAULT 'draft',
  effective_date date,
  end_date date,                              -- nullable: open-ended
  signed_by_partner text,                     -- name + role of partner signatory
  signed_by_coalition_user_id uuid REFERENCES users(id) ON DELETE SET NULL,
  template_version text,                      -- e.g. "ferpa-v1", "mou-phase0-v2"
  template_rendered text,                     -- the actual rendered text the partner saw + signed
  terms jsonb NOT NULL DEFAULT '{}'::jsonb,    -- kind-specific structured data
  notes text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CHECK (effective_date IS NULL OR end_date IS NULL OR effective_date <= end_date)
);

CREATE INDEX partner_agreements_partner_idx ON partner_agreements(partner_org_id);
CREATE INDEX partner_agreements_kind_status_idx ON partner_agreements(kind, status);
CREATE INDEX partner_agreements_active_idx ON partner_agreements(status) WHERE status = 'active';
```

Why JSONB for `terms` and not per-kind tables:

- The structured terms are **descriptive metadata**, not the legal instrument itself. The legal instrument is `template_rendered` (immutable text, signed). The `terms` column is for the admin UI to display "FERPA scope: attendance + address-changes + McKinney-Vento identification" in a structured way — not for query-on-shape decisions.
- Different agreement kinds have wildly different shapes (FERPA scope vs. MOU withdrawal terms vs. BAA security controls). A polymorphic table without JSONB would mean a wide row of mostly-NULL columns or a separate side-table per kind. JSONB collapses this cleanly and is queryable when you need it (`terms->>'scope'`).
- Application code validates the `terms` shape per kind via a discriminated union type (`PartnerAgreementTerms`). The DB stores the JSON; the lib enforces the shape. Same pattern as how we keep `audit_log.metadata` typed at the call site.

### Naming

`partner_agreements` (plural, snake_case) — matches the rest of the schema. The library code under `src/lib/oprt/` (operations tooling — MOU-flavored work) or `src/lib/dtrs/` (data-trust — FERPA-flavored work) decides which terms shape to validate. Each domain owns its kind:

- `oprt` owns: `mou`, `memo_of_cooperation`
- `dtrs` owns: `ferpa`, `baa`, `qsoa`, `dsa`

That keeps the privacy-critical agreement kinds (FERPA, BAA, QSOA, DSA) in the dtrs domain (most security-critical per `src/lib/dtrs/CLAUDE.md`), while the lighter MOUs live in `oprt`.

### Migration / API surface

A single migration creates the table + enums. No data backfill needed — `partner_orgs.dataSharingTier` (existing column) remains the runtime tier flag; this new table is the *paper trail*.

Public API (initial):

```ts
// src/db/queries/partner-agreements.ts
listAgreementsForPartner(partnerOrgId: string, opts?: { status? })
getActiveAgreementByKind(partnerOrgId: string, kind: PartnerAgreementKind)
recordAgreement(input: NewPartnerAgreement)        // admin-only, audit-logged
updateAgreementStatus(id, status, by_user_id)      // admin-only, audit-logged
```

Each domain (`oprt`, `dtrs`) exposes its own kind-specific helpers on top.

## Consequences

**What we get:**

- DTRS-010 ships against this table; OPRT-002 closes opportunistically (one row per Phase-0 MOU). Both stories collapse to "build this table + a kind-specific intake form" — DTRS-010 includes the table and FERPA intake; a future small story adds the MOU intake.
- One coherent admin surface for "what agreements exist?" — listing, filtering by kind/status, drill-down to the rendered template. Sprint 9 only ships the FERPA intake side, but the architecture supports the full set.
- BAA / QSOA / DSA work later just adds enum values + intake forms; no schema churn.
- The `template_rendered` column is the legal artifact — once an agreement is signed, this is what was agreed to. Mutating it later is a forensic bug; treat as append-only by convention (no triggers — this isn't audit_log).

**What we don't get:**

- Per-kind type safety at the DB layer. `terms` is `jsonb`; nothing in Postgres enforces "FERPA terms must contain `scope: string[]`." That's the price of the polymorphic table. We get type safety in the lib via `PartnerAgreementTerms` discriminated union.
- The agreement is *separate from* the data flow it authorizes. A signed FERPA agreement doesn't automatically open the spigot on `school_referrals` — the application code still has to check that an active FERPA agreement exists for the receiving partner before accepting referrals. That gating logic lives in the domain.

**What we should watch for:**

1. **Drift between `partner_orgs.dataSharingTier` and the active-agreement view.** The tier column predates this ADR; it's a runtime flag. Going forward, the source of truth for "can data flow" should be the existence of an active agreement of the right kind. Either deprecate `dataSharingTier` or make it derived. Tracked as a follow-up — out of scope for Sprint 9.
2. **Templates become living documents.** If we let admins edit the template *after* it's been rendered+signed, we lose the legal artifact. Convention: `template_rendered` is set once at signing and treated as immutable. Editing the template-version goes through a new agreement row, not an update.
3. **Multiple active agreements of the same kind for the same partner.** Pathological for FERPA / BAA (only one active at a time), fine for memos (multiple project-specific ones). Don't enforce uniqueness at the DB; let the domain decide.

## Implementation checklist (DTRS-010 picks this up)

- [ ] Migration `0035_DTRS-010_partner_agreements.sql` (NNNN_STORYID_descr.sql per FND-040e).
- [ ] Drizzle schema `src/db/schema/partner-agreements.ts` + enum entries in `src/db/schema/enums.ts`.
- [ ] `src/db/queries/partner-agreements.ts` with the 4 functions above.
- [ ] `src/lib/dtrs/partner-agreements.ts` — discriminated-union types for the `terms` JSON, `validateFerpaTerms`, audit-log integration.
- [ ] FERPA intake form at `src/app/app/admin/agreements/ferpa/page.tsx` (admin-only). Closes [#140](https://github.com/DobbsBoldry/homeless/issues/140).
- [ ] FERPA template page at `src/app/agreements/ferpa/template/page.tsx` (public, no auth — districts review before signing).
- [ ] Closes [#12](https://github.com/DobbsBoldry/homeless/issues/12) opportunistically by accepting `kind = 'mou'` in the registry; a follow-up story adds the MOU intake form (out of Sprint 9).
