# Database schema

Source of truth: `src/db/schema/*.ts`. Migrations in `drizzle/migrations/`.

## Phase 0 (current)

The Phase-0 schema is intentionally minimal — identity, organizations, audit
log, and consent records. **No client (PHI) data lives in the database yet.**
That comes in Phase 1 stories, gated behind the BAA with Owensboro Health.

```mermaid
erDiagram
    PARTNER_ORGS ||--o{ ORG_MEMBERSHIPS : has
    USERS ||--o{ ORG_MEMBERSHIPS : "belongs to"
    USERS ||--o{ AUDIT_LOG : "performs"

    USERS {
        uuid id PK
        text clerk_user_id UK
        text email
        text first_name
        text last_name
        user_role role
        timestamptz created_at
        timestamptz updated_at
    }

    PARTNER_ORGS {
        uuid id PK
        text name
        text slug UK
        partner_org_type type
        text contact_email
        text contact_phone
        bool active
        timestamptz created_at
        timestamptz updated_at
    }

    ORG_MEMBERSHIPS {
        uuid id PK
        uuid user_id FK
        uuid partner_org_id FK
        user_role role
        timestamptz created_at
    }

    AUDIT_LOG {
        uuid id PK
        uuid actor_user_id FK
        text action
        text target_table
        text target_id
        jsonb metadata
        timestamptz created_at
    }

    CONSENTS {
        uuid id PK
        text subject_external_id
        consent_type consent_type
        consent_channel granted_via
        timestamptz granted_at
        timestamptz revoked_at
        text notes
        timestamptz created_at
    }

    HEALTH_CHECK {
        uuid id PK
        timestamptz created_at
    }

    EVICTION_FILINGS {
        uuid id PK
        text case_number
        timestamptz filed_at
        text court_division
        text plaintiff
        text defendant_first_name
        text defendant_last_name
        text defendant_address
        eviction_cause_type cause_type
        int amount_claimed_cents
        eviction_filing_status status
        eviction_filing_source source
        jsonb raw_json
        timestamptz created_at
        timestamptz updated_at
    }
```

## Tables

| Table | Purpose | PHI risk |
|---|---|---|
| `users` | Identity mirror of Clerk users + their primary global role | none |
| `partner_orgs` | Coalition member organizations (hospital, legal aid, shelter, etc.) | none |
| `org_memberships` | M:N user↔org with per-org role for multi-tenant access | none |
| `audit_log` | Append-only record of significant system actions | none — never log PHI in `metadata` |
| `consents` | Subject consent records (PHI sharing, SMS, etc.). Subject linkage is by external ID until clients table lands in Phase 1. | non-PHI |
| `health_check` | DB roundtrip target for `/api/health` | none |
| `eviction_filings` | Public court records of filed eviction cases. Source-tagged so we can land synthetic, manual, and CourtNet rows side-by-side. | non-PHI (public record) |

## Enums

| Enum | Values |
|---|---|
| `user_role` | attorney, caseworker, ed_coordinator, shelter_staff, admin |
| `partner_org_type` | hospital, legal_aid, shelter, community_org, government, other |
| `consent_type` | phi_share_within_coalition, sms_communication, data_for_program_eval |
| `consent_channel` | sms, in_person, web_form, phone, paper |
| `eviction_cause_type` | non_payment, lease_violation, holdover, other |
| `eviction_filing_status` | filed, served, judgment, dismissed, sealed |
| `eviction_filing_source` | courtnet, manual, synthetic |

## Conventions

- All PKs are `uuid` with `default gen_random_uuid()`.
- Timestamps are `timestamp with time zone` and default to `now()`.
- Every FK column has a btree index.
- `audit_log` is append-only — never `UPDATE` or `DELETE` rows. Use
  `logAuditEvent()` from `src/lib/audit.ts` to write.
- `consents` revocations set `revoked_at`; rows are never deleted.
- Schema files live in `src/db/schema/{table}.ts`, exported via `index.ts`.

## Seeding

`pnpm db:seed` creates a baseline of fixture data (1 org + 5 users, one per
role, + 3 audit entries). Idempotent — safe to re-run.
