# Access control — role + org-membership model

This doc explains how the platform decides "can this signed-in user see/do this." It's the mental model for engineers wiring new pages and server actions.

## Two layers

We have two complementary checks. Most routes use just the first; KLA-only routes use both.

### Layer 1 — Global role (`users.role`)

Every user has a single primary role assigned at provisioning time:

| Role            | Who                                               |
|-----------------|---------------------------------------------------|
| `pending`       | Brand-new sign-up; can't see PHI or case data yet |
| `attorney`      | A licensed attorney working evictions             |
| `caseworker`    | A non-clinical case worker (shelter, community)   |
| `ed_coordinator`| ED super-utilizer care coordinator                |
| `shelter_staff` | Shelter intake / bed management staff             |
| `admin`         | Platform admin (us, until partners are onboarded) |

The role gate is `requireRole(allowed: readonly UserRole[])` in [src/lib/auth.ts](../src/lib/auth.ts). Use it as the **first line** of any role-gated server component or server action. It calls `notFound()` if the user's role isn't in the allow-list — we 404 rather than 403 so we don't leak which routes exist for which roles.

### Layer 2 — Partner-org membership (`org_memberships`)

A user can belong to one or more partner orgs (`partner_orgs`), with a possibly different scoped role per org. This lets us say "Ada is a global `attorney`, AND a member of the KLA Owensboro org" — needed when multiple legal-aid partners join the platform and we want to scope what each org's staff can see.

The first concrete partner-scoped helper is `requireKlaAttorney()` (also in [src/lib/auth.ts](../src/lib/auth.ts)):

- Returns the user only if `user.role === 'attorney'` AND they are a member of the partner org with slug `kla-owensboro`.
- Otherwise `notFound()`.

## Phase 1 assumption: KLA is the only legal-aid partner

For Phase 1 (pilot), Kentucky Legal Aid - Owensboro (`slug: kla-owensboro`, `type: legal_aid`) is the only legal-aid partner. The KLA-only views — daily docket, response-packet generator, etc. — gate on `requireKlaAttorney()` rather than a generic `requireRole(['attorney'])`.

This matters because as the network grows, an "attorney" role check alone would let a future partner attorney see KLA's queue. Membership-scoped gating prevents that by construction.

When a second legal-aid partner joins, generalize to a `requirePartnerOrgRole(slug, role)` helper rather than fan out per-org helpers.

## When to use which

| Route / action                        | Gate                                        |
|---------------------------------------|---------------------------------------------|
| Filings dashboard (`/app/cases/filings`) | `requireRole(CaseFilingsRoles)` (multi-role) |
| Case detail (`/app/cases/filings/[id]`)  | `requireRole(CaseFilingsRoles)`              |
| KLA daily queue (`/app/cases/queue`)     | `requireKlaAttorney()`                       |
| Response-packet generator                | `requireKlaAttorney()`                       |
| Audit log viewer                          | `requireRole(['admin'])`                     |

## Sidebar visibility ≠ access control

`navItemsForRole` controls which sidebar links a user sees, but it is **presentation only**. The server-side `requireRole` / `requireKlaAttorney` call inside each page (and each server action) is the authoritative gate. Never trust the sidebar to hide routes for security purposes.

## Seeding

`pnpm db:seed` creates one user per global role plus the two partner orgs (Audubon Area and KLA Owensboro). The seed `attorney` user (Ada Attorney) is a member of both orgs so a developer signed in as Ada can access KLA-only routes locally.

## Open questions / future work

- Add `member_of_org(slug)` column-level helpers for queries that need to scope DB reads by org membership (e.g. an attorney from a different legal-aid partner viewing only their org's filings).
- Decide whether `admin` should pass `requireKlaAttorney()` for support/troubleshooting or stay strictly excluded. Phase 1: strictly excluded.
