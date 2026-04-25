# Daviess Coalition Platform — Engineering Backlog & Sprint Plan

**Owner:** Bo (solo MVP build) · **Methodology:** Fibonacci story points, 2-week sprints · **Tracking:** GitHub Issues + Projects · **Last updated:** April 2026

This is the comprehensive engineering plan from Phase 0 through Phase 4. It assumes solo development for personal validation, with Phase 1 use cases as the priority horizon and later phases scoped at decreasing granularity (more refinement happens once Phase 1 ships).

---

## Tech stack (greenfield defaults)

These are the defaults I'm planning around. They're chosen for cheapest viable shipping path with a credible upgrade path to HIPAA-eligible infrastructure once real PHI flows.

| Layer | Choice | Rationale |
|---|---|---|
| Language | TypeScript | Typesafe, broad ecosystem, single language across stack |
| Framework | Next.js 15 (App Router) | Full-stack React, server actions, edge + node runtimes, great DX |
| Styling | Tailwind CSS | Already used in docs site; keeps visual continuity |
| UI components | shadcn/ui | Copy-in, no lock-in, clean defaults, Tailwind-native |
| Database | PostgreSQL via Supabase | Hosted Postgres + auth + storage + realtime; Row-Level Security; free tier through MVP |
| ORM | Drizzle | Lightweight, SQL-first, typesafe |
| Auth | Clerk | Best DX for solo dev; orgs/roles/SSO; swap to Supabase Auth later if budget |
| AI | Anthropic Claude API (Sonnet 4.6 default, Opus 4.6 for complex reasoning) | Best instruction-following; HIPAA BAA available via Anthropic for Phase 1 PHI work |
| SMS / voice | Twilio | Industry standard; SMS, voice IVR, MMS; HIPAA-eligible with BAA |
| Email | Resend | Simple API; React email templates |
| Background jobs | Inngest | Event-driven, scheduled jobs, retries, observability built-in |
| Maps | Mapbox GL JS | Best heat-map and geocoding; freemium tier |
| Observability | Sentry + PostHog | Errors + product analytics; free/cheap tiers |
| Hosting | Railway (MVP) → Vercel + AWS (Phase 1+) | Railway already used for docs; Vercel for prod frontend; AWS for HIPAA-bound data services |
| File storage | Supabase Storage (MVP) → S3 (Phase 1+) | Cheap to start; migrate when HIPAA matters |
| Repo | GitHub (single monorepo) | Pairs naturally with Issues + Projects |
| Package manager | pnpm | Fast, efficient |
| CI/CD | GitHub Actions | Free for public + reasonable for private |

**Upgrade path for HIPAA work** (when real PHI starts flowing in Phase 1): migrate database off Supabase to AWS RDS Postgres or Aurora under a signed BAA; route Claude API calls through Anthropic's HIPAA-eligible endpoint; route Twilio through HIPAA-eligible account; add audit-log middleware. Budget ~2-3 sprints for that migration when the BAA with Owensboro Health is signed.

---

## Methodology

### Story point scale (Fibonacci)

| Points | Meaning | Solo dev rough time |
|---|---|---|
| 1 | Trivial. A config change or one small file. | < 1 hour |
| 2 | Small. One file, no dependencies, no surprises. | 2-4 hours |
| 3 | Real story. Multiple files, light integration. | half-day |
| 5 | Standard story. Spans frontend + backend or has one tricky bit. | 1 day to half-week |
| 8 | Big story. Multiple integration points, real complexity. | 3-5 days |
| 13 | Too big — split. If it stays at 13, do a discovery spike first. | > 1 week |
| 21 | Don't accept this in a sprint. Always split. | — |

### Definition of Ready (DoR)

A story is ready to enter a sprint when:
- Acceptance criteria are written
- Dependencies are identified and not blocked
- Tech approach is roughly known (or there's an explicit spike story)
- It's sized at 8 or below (13s get split first)

### Definition of Done (DoD)

A story is done when:
- Code is merged to main
- All acceptance criteria pass manual verification
- Has at least one happy-path test (when code touches data flow)
- Updated relevant docs (README, schema, API)
- Deployed to staging
- No new Sentry errors

### Sprint cadence

- **Length:** 2 weeks
- **Capacity:** Plan ~13 points/sprint (assumes near-full-time solo); halve for evenings/weekends pace
- **Ceremonies:** Sprint planning at start (45 min, write goals + commit stories); retro at end (30 min, what worked / what didn't / what to change). Self-facilitated.
- **No daily standup** (solo). Weekly self-check-in instead: "still on track for sprint goal?"

### Branch strategy

- `main` — always deployable to staging
- Feature branches off main, named `phase{N}/{epic-prefix}-{ticket-num}-{slug}` (e.g. `phase1/EVDT-007-risk-scoring`)
- Squash-merge to main with PR description that includes ticket and acceptance-criteria checklist

---

## Epic index

Epics organized by capability pillar plus cross-cutting infrastructure. Total scope estimated at **~720 story points** (~50 two-week sprints, ~24 months at solo near-full-time pace).

| ID | Epic | Phase | Pts | Sprints | Notes |
|---|---|---|---|---|---|
| FND | Foundation & Infrastructure | 0–1 | 60 | 4-5 | Repo, auth, DB, base UI, deploy, observability |
| EVDT | Eviction Defense Triage | 1 | 89 | 6 | First flagship use case; public data, no BAA |
| ESUC | ED Super-Utilizer Care Coordination | 1 | 95 | 7 | Second flagship; gated on Owensboro Health BAA |
| CWT | Caseworker Tools | 1–2 | 110 | 8 | Conversational intake, AI notes, screener, cross-agency |
| INDC | Individual Companion (Mobile) | 1–2 | 105 | 7-8 | Bed finder, doc recovery, benefits, mood, consent |
| COOR | Inter-Agency Coordination | 1–2 | 65 | 5 | Bed availability, donation/volunteer matching, handoffs |
| PRVN | Prevention & Early Detection | 2 | 50 | 4 | Beyond eviction: school, utility, ED first-time flag |
| DTRS | Data Trust & Compliance Layer | 1–2 | 70 | 5 | Consent UX, BAA plumbing, abuser-blind, audit log |
| OPRT | Coalition Operations Tooling | 1–2 | 35 | 3 | FAG portal, MOU registry, decision log, public dashboard |
| PCYI | Policy & Intelligence | 2–3 | 60 | 5 | Fiscal Court brief, intervention efficacy, simulation |
| SUPP | Supply-Side Tools | 3 | 75 | 6 | Vacant property, ADU, landlord matching, conversion |
| SUBP | Subpopulation Pathways | 2–3 | 70 | 5 | Foster, DV, reentry, veterans, older adults, etc. |
| REPL | Replication & Open-Source | 4 | 40 | 3 | Productized kit for other counties |
| FULL | Full Vision (multilingual, voice, multi-state) | 4 | 50 | 4 | ASL video, full multilingual, cross-state |

---

## Cross-cutting decisions

These apply across all epics. Capture once.

### Data model conventions
- All tables have `id`, `created_at`, `updated_at`, `deleted_at` (soft delete by default)
- All PII tables have `consent_id` foreign key linking to a `consents` table
- All cross-agency data flows through a `data_access_log` table for audit
- DV-flagged records (table column `dv_flag boolean`) get a `LOCATION_REDACTED` constraint applied at the query layer

### Auth and access conventions
- Three role tiers: `superadmin`, `coalition_staff`, `partner_user`
- Partner users belong to one or more `partner_orgs` and have role `caseworker | attorney | admin | observer`
- Every page/API check uses Clerk middleware + Drizzle RLS-equivalent policy table
- Lived-experience advisors are first-class users with their own `LivedExperienceAdvisor` role and compensation tracking

### Consent conventions
- Default state: NO data flows
- Explicit consent recorded with version, scope, expiration, withdrawable
- Consent UI mockups validated with paid lived-experience advisors before any client data flows (gating story)

### Observability conventions
- Every consent decision, data access, AI generation, and outbound message logged
- Sentry receives errors only (no PII)
- PostHog receives anonymous product events (no client identifiers)

---

## Sprint sequence (high-level)

Sprints sequenced to respect dependencies and to front-load Phase 1 use cases that don't require partner BAAs.

| Sprint | Phase | Focus | Stories committed (rough) |
|---|---|---|---|
| 1-2 | 0 | Foundation & repo bootstrap | FND-001 through FND-008 |
| 3 | 0 | Coalition operations starter (FAG portal, partner registry) | OPRT-001 through OPRT-005 |
| 4-5 | 0 | Eviction Defense spike + court docket research | EVDT-001 through EVDT-004 |
| 6-9 | 1 | Eviction Defense Triage MVP (live with KLA workflow) | EVDT-005 through EVDT-018 |
| 10-12 | 1 | Caseworker Tools — conversational intake + AI notes (synthetic data first) | CWT-001 through CWT-012 |
| 13 | 1 | Data Trust foundation (consent UX, audit log) | DTRS-001 through DTRS-006 |
| 14-15 | 1 | Coordination — real-time bed availability (3 anchor shelters) | COOR-001 through COOR-008 |
| 16-17 | 1 | Individual Companion — SMS bed finder | INDC-001 through INDC-009 |
| 18-22 | 1 | ED Super-Utilizer Care Coordination (post-BAA) | ESUC-001 through ESUC-018 |
| 23-24 | 1-2 | HIPAA migration + Phase 1 hardening | DTRS-007 through DTRS-014 |
| 25-32 | 2 | Caseworker tools full set, prevention signals, pathways begin | CWT, PRVN, SUBP |
| 33-38 | 2 | Individual Companion full set, faith-based aggregate, schools | INDC, COOR, OPRT |
| 39-44 | 3 | Supply-Side capabilities | SUPP, PCYI |
| 45-50 | 3-4 | Replication kit, full-vision items | REPL, FULL |

**Note:** Phase 1 sprints (6-22) are detailed below story-by-story. Phase 2-4 sprints are sketched at the epic level — they'll get story-level decomposition as Phase 1 ships and we learn velocity.

---

# Phase 0 — Foundation (Sprints 1–5)

Phase 0 is mostly coalition relationship-building (per the strategy site), not coding. But there are real engineering tasks that should ship in parallel: the dev environment, the operations tooling that supports kitchen-cabinet conversations, and the pre-build research spikes for Phase 1.

## Sprint 1: Bootstrap

**Sprint goal:** New repo, new app, deployed to staging, "Hello world" with auth and a database.

| ID | Title | Pts | Notes |
|---|---|---|---|
| FND-001 | Initialize Next.js 15 + TypeScript + Tailwind + shadcn/ui repo | 2 | Single command init, push to GitHub |
| FND-002 | Configure Supabase project + Postgres + Drizzle | 3 | Schema migrations file structure; first migration |
| FND-003 | Configure Clerk auth + protected routes scaffold | 3 | Sign-in/sign-up, middleware, basic role |
| FND-004 | Set up GitHub Actions CI (lint, typecheck, test) | 2 | Run on PR + main |
| FND-005 | Deploy to Railway (staging) with env config | 2 | Reuse existing Railway setup pattern |
| FND-006 | Configure Sentry for errors + PostHog for events | 2 | Server + client instrumentation |
| **Total** | | **14** | |

## Sprint 2: Foundation continued + design system

**Sprint goal:** Base UI shell, role-based access, Inngest scheduled jobs working.

| ID | Title | Pts | Notes |
|---|---|---|---|
| FND-007 | Build base UI shell (sidebar nav, top bar, layout) using docs-site visual language | 5 | Reuse Tailwind tokens from docs |
| FND-008 | Define core data model: users, partner_orgs, roles, audit_log, consents | 5 | Drizzle schema + seed data |
| FND-009 | Set up Inngest for scheduled jobs (cron-style + event-driven) | 3 | "Hello world" cron firing daily |
| FND-010 | Build role-aware nav and access control middleware | 3 | superadmin / coalition_staff / partner_user split |
| **Total** | | **16** | |

## Sprint 3: Coalition operations starter

**Sprint goal:** Internal-coalition tooling that supports kitchen-cabinet conversations even before client-facing features ship.

| ID | Title | Pts | Notes |
|---|---|---|---|
| OPRT-001 | Partner organization registry (CRUD: name, type, contact, status) | 3 | First "real" data model |
| OPRT-002 | MOU registry table with status (draft/active/expired) | 3 | Linked to partner_orgs |
| OPRT-003 | Decision log (Steering Committee decisions with vote counts) | 5 | Markdown body + structured metadata |
| OPRT-004 | Frontline Advisory Group member registry + compensation tracker | 3 | Pay rate, hours logged, payout status |
| OPRT-005 | Internal coalition dashboard (#partners, MOUs active, recent decisions) | 3 | Read-only summary |
| **Total** | | **17** | |

## Sprint 4: Eviction Defense — research spike

**Sprint goal:** Lock down how we get the Daviess District Court eviction docket. Produce a working manual scrape against the live docket.

| ID | Title | Pts | Notes |
|---|---|---|---|
| EVDT-001 | Spike: KY CourtNet API access investigation | 5 | Memo: 3 access mechanisms with pros/cons |
| EVDT-002 | Spike: Daviess District Court Clerk's office relationship + manual export feasibility | 3 | Phone call + memo on what they'll provide |
| EVDT-003 | Build first manual scrape (today's docket → JSON) | 5 | Disposable code OK; goal is proving access |
| EVDT-004 | Define Eviction Filing data model | 3 | filings table: case_num, household, filed_at, status, etc. |
| **Total** | | **16** | |

## Sprint 5: Eviction Defense — daily ingestion pipeline

**Sprint goal:** Daily automated docket scrape running in production. Stored, deduped, queryable.

| ID | Title | Pts | Notes |
|---|---|---|---|
| EVDT-005 | Production scraper (Inngest cron, daily 6 AM CT) | 5 | Idempotent, retries, alert on failure |
| EVDT-006 | Eviction filing parser (extract structured fields from docket entries) | 5 | Test against 2 weeks of historical filings |
| EVDT-007 | Filing deduplication and update logic | 3 | Same case_num across days, status changes |
| EVDT-008 | Internal "today's filings" dashboard (raw view, no AI yet) | 3 | Quick proof we have data flowing |
| **Total** | | **16** | |

---

# Phase 1 — Prove It (Sprints 6–22)

## Sprint 6-9: Eviction Defense Triage (full MVP)

**Sprint goal across 4 sprints:** Daily eviction docket → AI risk-scored → tenant response packet pre-drafted → KLA attorney workflow → outcome tracking. Live, in production, demoable to Kentucky Legal Aid Owensboro.

### Sprint 6

| ID | Title | Pts | Notes |
|---|---|---|---|
| EVDT-009 | AI risk-scoring service (Claude API: filing → 0-100 risk score with rationale) | 8 | Prompt iteration; eval set of 20 historical filings |
| EVDT-010 | Risk score storage + ranking logic | 3 | Daily ranked queue |
| EVDT-011 | Children-in-household detection (court record + cross-ref to parser) | 5 | Affects risk score significantly |
| **Total** | | **16** | |

### Sprint 7

| ID | Title | Pts | Notes |
|---|---|---|---|
| EVDT-012 | Tenant response packet generator (Claude API: filing → draft answer) | 8 | KY-specific filing form; legal disclaimers; AI authorship label |
| EVDT-013 | Packet review/edit UI (rich text, accept/reject AI sections) | 5 | Track edits as feedback signal |
| EVDT-014 | Available rental assistance match (KHC + KY HEALTH database) | 3 | First version: lookup table; later: API |
| **Total** | | **16** | |

### Sprint 8

| ID | Title | Pts | Notes |
|---|---|---|---|
| EVDT-015 | KLA daily docket dashboard (ranked queue, filters, search) | 5 | Primary attorney workflow |
| EVDT-016 | Case detail view (filing data, risk score, household, history) | 3 | |
| EVDT-017 | Closed-loop case status tracking (draft → filed → outcome) | 5 | Manual status updates by attorney |
| EVDT-018 | KLA attorney auth + role (`attorney` partner role) | 3 | Clerk org, RBAC |
| **Total** | | **16** | |

### Sprint 9

| ID | Title | Pts | Notes |
|---|---|---|---|
| EVDT-019 | Daily 6 AM email digest to KLA attorneys (top 10 cases) | 3 | Resend; markdown email |
| EVDT-020 | Outcome metrics dashboard (representation rate, default judgment rate) | 5 | Comparison to historical baseline |
| EVDT-021 | Eviction case PDF export (for filing) | 3 | KY court PDF format |
| EVDT-022 | KLA user manual + onboarding flow | 3 | First "real user" docs |
| EVDT-023 | Demo to KLA Owensboro managing attorney | 2 | Schedule, present, capture feedback |
| **Total** | | **16** | |

**Phase 1 milestone reached: Eviction Defense Triage live with real KLA users.**

## Sprint 10-12: Caseworker Tools (synthetic data MVP)

**Sprint goal across 3 sprints:** Conversational intake + AI case notes + benefits screener, working against synthetic data so it can be demoed to shelter directors before any data-sharing agreements are in place.

### Sprint 10

| ID | Title | Pts | Notes |
|---|---|---|---|
| CWT-001 | Synthetic intake conversation generator (Claude API: realistic shelter-intake transcripts) | 5 | Test data foundation |
| CWT-002 | Conversational intake recorder (audio capture or text input with consent flow) | 5 | Browser MediaRecorder; consent screen |
| CWT-003 | Conversation → structured profile extractor (Claude API) | 8 | Schema: demographics, household, history, needs, gaps |
| **Total** | | **18** | |

### Sprint 11

| ID | Title | Pts | Notes |
|---|---|---|---|
| CWT-004 | AI case note draft generator (Claude API: structured profile → narrative note) | 5 | Caseworker voice; AI-authorship label |
| CWT-005 | Case note review/edit UI with version history | 5 | Track edits; rejections become training data |
| CWT-006 | Caseworker dashboard (active clients, recent intakes, gaps) | 5 | First caseworker view |
| **Total** | | **15** | |

### Sprint 12

| ID | Title | Pts | Notes |
|---|---|---|---|
| CWT-007 | Benefits eligibility screener (rule engine: SNAP, KCHIP, KTAP, SSI, VA, LIHEAP) | 8 | Static rules first; KY-specific income thresholds |
| CWT-008 | Benefits dollar-value estimator + application path | 3 | "You'd qualify for $432/mo SNAP, here's how to apply" |
| CWT-009 | Triage tier recommendation (rule-based v1: high/medium/low housing-stability potential) | 3 | Ready to be replaced by ML in Phase 2 |
| CWT-010 | Demo to shelter director (Daniel Pitino or similar) | 2 | First product demo to actual provider |
| **Total** | | **16** | |

## Sprint 13: Data Trust foundation

**Sprint goal:** Build the data plumbing that supports consent-first, abuser-blind, and audit-everything before any cross-agency data flows. This is the gate before Phase 1 healthcare integration.

| ID | Title | Pts | Notes |
|---|---|---|---|
| DTRS-001 | Consent record data model + state machine (granted, scoped, revoked, expired) | 5 | Versioned, partner-scoped |
| DTRS-002 | Client consent UX (plain-language form, signed, revokable) | 5 | Designed for low-literacy + high-trust |
| DTRS-003 | Audit log for every record access + AI generation | 3 | Append-only, queryable |
| DTRS-004 | DV abuser-blind protocol implementation (location suppression in queries) | 5 | Default-on for `dv_flag = true` records |
| DTRS-005 | Lived-experience advisor consent UX review (paid session) | 2 | Gating step before client data flows |
| **Total** | | **20** | (Heavy sprint — may slip to next) |

## Sprint 14-15: Coordination — real-time bed availability

**Sprint goal:** Live bed-count board across 3 anchor Daviess shelters (Boulware, St. Benedict's, Daniel Pitino), visible to coalition staff and 211 dispatchers.

### Sprint 14

| ID | Title | Pts | Notes |
|---|---|---|---|
| COOR-001 | Shelter data model (capacity, current count, filters: gender, family, pet-friendly, SUD) | 3 | |
| COOR-002 | Bed-count update UI for shelter staff (1-click add/remove) | 5 | Mobile-friendly; <30 sec per update |
| COOR-003 | Live bed availability board (read view, refresh every 60s) | 5 | Card-per-shelter layout |
| COOR-004 | Filter and search on bed board | 3 | "Pet-friendly + family" preset |
| **Total** | | **16** | |

### Sprint 15

| ID | Title | Pts | Notes |
|---|---|---|---|
| COOR-005 | Bed-hold/reservation flow (90-minute soft hold from intake) | 5 | Expires, releases automatically |
| COOR-006 | SMS lookup of bed availability (for 211 dispatchers, caseworkers) | 5 | Twilio SMS; "BEDS" command |
| COOR-007 | Shelter staff onboarding for 3 anchor shelters (Boulware, St. Benedict's, Daniel Pitino) | 3 | Field rollout; capture friction |
| COOR-008 | Demo + handoff to 211 Kentucky operator | 3 | End-to-end live use |
| **Total** | | **16** | |

## Sprint 16-17: Individual Companion — SMS bed finder

**Sprint goal:** Unhoused individuals can text `BED` to a coalition number and get back live bed availability filtered to their needs. First client-facing capability.

### Sprint 16

| ID | Title | Pts | Notes |
|---|---|---|---|
| INDC-001 | Twilio SMS webhook + command parser (`BED`, `BED FAMILY`, `BED PET`) | 5 | Idempotent; rate-limited |
| INDC-002 | Bed-finder query against COOR data with filters | 3 | |
| INDC-003 | SMS reply formatting (≤320 chars, walking distance, hold instructions) | 3 | |
| INDC-004 | Conversation state (multi-turn: "where are you?" → location → result) | 5 | |
| **Total** | | **16** | |

### Sprint 17

| ID | Title | Pts | Notes |
|---|---|---|---|
| INDC-005 | SMS shorthand expansion (`FOOD`, `HELP`, `STORY`) | 5 | Routes to corresponding service info |
| INDC-006 | Outbound SMS hold-confirmation to user when shelter approves | 3 | |
| INDC-007 | Privacy-respecting message log (anonymized) | 3 | For volume tracking, not surveillance |
| INDC-008 | SMS-as-a-service onboarding doc (so staff can hand the number to clients) | 2 | One-pager flyer |
| INDC-009 | First-week metrics review (volume, completion rate, friction points) | 3 | |
| **Total** | | **16** | |

## Sprint 18-22: ED Super-Utilizer Care Coordination

**Sprint goal across 5 sprints:** Owensboro Health ED housing-status flag → daily care-coordinator queue → AI care plan suggestion → Recuperative Care match → outcome tracking. Gated on signed BAA with Owensboro Health and FHIR access negotiated.

### Sprint 18 — pre-flight

| ID | Title | Pts | Notes |
|---|---|---|---|
| ESUC-001 | BAA signed with Owensboro Health (non-engineering blocker) | — | Coordination, not code |
| ESUC-002 | HIPAA infrastructure migration (Postgres → AWS RDS or equivalent BAA-eligible) | 13 | One sprint; split if needed |
| ESUC-003 | Anthropic HIPAA-eligible API endpoint configuration | 3 | Routing + audit |
| ESUC-004 | Twilio HIPAA account migration | 2 | |
| **Total** | | **18** | (Carries over if BAA delayed) |

### Sprint 19

| ID | Title | Pts | Notes |
|---|---|---|---|
| ESUC-005 | Owensboro Health Epic FHIR integration spike | 8 | Discovery: which resources, auth flow, sandbox access |
| ESUC-006 | ED admission webhook receiver (FHIR Patient + Encounter) | 5 | |
| ESUC-007 | Housing-status field extraction from Encounter | 3 | Structured + free-text parsing |
| **Total** | | **16** | |

### Sprint 20

| ID | Title | Pts | Notes |
|---|---|---|---|
| ESUC-008 | Super-utilizer detection (3+ ED visits in 6 months + housing-unstable) | 5 | First flag query |
| ESUC-009 | Daily super-utilizer queue for OH care coordinators | 5 | Cohort dashboard |
| ESUC-010 | HMIS cross-reference via KHC (with consent) | 5 | Phase 2 might tighten this |
| **Total** | | **15** | |

### Sprint 21

| ID | Title | Pts | Notes |
|---|---|---|---|
| ESUC-011 | AI care plan generator (Claude: cohort context → suggested intervention plan) | 8 | Heavily caseworker-reviewed |
| ESUC-012 | Recuperative Care eligibility check (TEAMKY waiver criteria) | 5 | Rule engine |
| ESUC-013 | Recuperative Care bed match (Catholic Charities partnership / hotel-respite) | 3 | Stub if partnership not live |
| **Total** | | **16** | |

### Sprint 22

| ID | Title | Pts | Notes |
|---|---|---|---|
| ESUC-014 | Care coordinator workflow UI (queue, case detail, plan editor, status) | 8 | Daily working surface |
| ESUC-015 | TEAMKY HRSN billing event capture (for OH revenue cycle) | 5 | Generates billable encounters |
| ESUC-016 | ED-revisit tracking (90/180-day re-admit rate per cohort member) | 3 | Outcome measure |
| ESUC-017 | First-month results report for OH Population Health (Dr. Tidwell) | 2 | Format: 1-pager |
| ESUC-018 | Onboard 1-2 OH care coordinators to live workflow | 2 | First production users |
| **Total** | | **20** | (Heavy; may overflow) |

**Phase 1 milestone reached: ED super-utilizer care coordination live, billing TEAMKY HRSN, with OH care coordinators using it.**

---

# Phase 2 — Trust and Expand (Sprints 23–38)

Phase 2 broadens what Phase 1 proved out: faith-based opt-in, school early warning, expanded subpopulation pathways, full-feature Caseworker Tools and Individual Companion. Each epic listed at story level; sprint sequencing will refine after Phase 1 velocity is real.

## Epic: Caseworker Tools (continued, ~95 pts)

| ID | Title | Pts |
|---|---|---|
| CWT-011 | Cross-agency client view (consent-gated; OH ED + KLA + shelters + Catholic Charities aggregate) | 8 |
| CWT-012 | Pre-meeting summary generator (Claude: changes since last visit) | 5 |
| CWT-013 | Mood-check change alerts | 3 |
| CWT-014 | Override tracking on triage recommendations (signal for retraining) | 5 |
| CWT-015 | Grant report drafter (Claude: agency outcomes → funder-formatted report) | 8 |
| CWT-016 | Funder-specific KPI templates (PLFO, OH CHI, Hilton, RWJF, Melville) | 5 |
| CWT-017 | Donor impact report generator (per-donor metrics) | 5 |
| CWT-018 | Caseworker mobile responsive UI | 5 |
| CWT-019 | Voice-recorded intake (audio → transcript → structured profile) | 8 |
| CWT-020 | Caseworker scheduling integration (Google/Outlook calendar) | 5 |
| CWT-021 | Document upload + AI extraction (IDs, prior records) | 5 |
| CWT-022 | Caseworker handoff workflow (between agencies, consent-gated) | 8 |
| CWT-023 | Frontline Advisory Group feedback capture inside the tool | 3 |
| CWT-024 | Configurable triage tier definitions per agency (FAG-defined) | 5 |
| CWT-025 | Comprehensive caseworker user manual + training videos | 5 |
| CWT-026 | Time-saved metric per caseworker per week (key adoption KPI) | 3 |

## Epic: Individual Companion (continued, ~85 pts)

| ID | Title | Pts |
|---|---|---|
| INDC-010 | Smartphone web app (PWA) shell with offline support | 8 |
| INDC-011 | Document recovery walkthrough (KY ID, SSN, birth cert, DD-214) | 8 |
| INDC-012 | Pre-fill recovery applications from user vault | 5 |
| INDC-013 | Benefits screening for end-user (same engine as CWT-007, client-facing) | 5 |
| INDC-014 | Benefits application drafting + submission tracker | 8 |
| INDC-015 | Mood check-in (PHQ-2 daily, PHQ-9 weekly, optional) | 5 |
| INDC-016 | Crisis routing (Columbia C-SSRS triggers warm handoff) | 8 |
| INDC-017 | Consent control panel (see who has my data, revoke, audit log) | 8 |
| INDC-018 | Voice IVR for users without smartphones | 13 |
| INDC-019 | Text-shorthand library expansion (`MEDS`, `PAY`, `DOC`) | 3 |
| INDC-020 | Companion home screen (today's appointments, mood, action items) | 5 |
| INDC-021 | Multimodal accessibility (Spanish translation v1) | 8 |

## Epic: Coordination (continued, ~30 pts)

| ID | Title | Pts |
|---|---|---|
| COOR-009 | All 6 Daviess shelters integrated (Boulware, St. Benedict's, Daniel Pitino, CrossRoads, OASIS, St. Joseph) | 5 |
| COOR-010 | Specific donation matching (donor offer → family need) | 5 |
| COOR-011 | Volunteer skill matching (taxonomy + matching engine) | 8 |
| COOR-012 | Inter-agency handoff workflow (consent-gated context transfer) | 5 |
| COOR-013 | 7-14 day demand forecasting per shelter | 5 |
| COOR-014 | Closed-loop referral confirmation (school → coalition → school) | 3 |

## Epic: Prevention & Early Detection (continued, ~50 pts)

| ID | Title | Pts |
|---|---|---|
| PRVN-001 | ED first-time-homeless flag (alert OH social worker before discharge) | 5 |
| PRVN-002 | School attendance pattern signal (DCPS + Owensboro Independent integration) | 13 |
| PRVN-003 | McKinney-Vento liaison referral receiver | 5 |
| PRVN-004 | Closed-loop reporting school ↔ coalition | 5 |
| PRVN-005 | Utility shutoff aggregate heat-map (OMU partnership) | 8 |
| PRVN-006 | Outreach pre-positioning workflow (Catholic Charities mobile coordination) | 5 |
| PRVN-007 | Macro demand forecasting (employer announcements, eviction trends, ED super-utilizer movement) | 8 |

## Epic: Subpopulation Pathways (Phase 2 set, ~50 pts)

| ID | Title | Pts |
|---|---|---|
| SUBP-001 | Foster aging-out 18th-birthday countdown engine | 8 |
| SUBP-002 | TEAMKY Former Foster Youth Medicaid extension automation (forms, eligibility) | 5 |
| SUBP-003 | DCBS partnership integration (foster youth identification) | 8 |
| SUBP-004 | DV survivor pathway (OASIS partnership; abuser-blind protocols extended) | 8 |
| SUBP-005 | Reentry pathway (KY DOC partnership; 60-day pre-release window automation) | 8 |
| SUBP-006 | Veteran pathway (HUD-VASH voucher matching; VFW Owensboro coordination) | 8 |
| SUBP-007 | Families w/ children pathway (McKinney-Vento integration; school-stability prioritization) | 5 |

## Epic: Data Trust (continued, ~50 pts)

| ID | Title | Pts |
|---|---|---|
| DTRS-007 | Faith-friendly aggregate-only data schema (counts only, no individual records) | 8 |
| DTRS-008 | Catholic Charities Owensboro aggregate intake form | 5 |
| DTRS-009 | Per-ministry coordination signals (without individual identifiers) | 5 |
| DTRS-010 | FERPA-compliant school data agreement template + intake | 5 |
| DTRS-011 | DCBS state data-sharing agreement workflow | 5 |
| DTRS-012 | KY DOC data-sharing agreement workflow | 5 |
| DTRS-013 | Quarterly transparency report generator (anonymized, public) | 5 |
| DTRS-014 | Independent academic validation portal (Brescia or partner; outcomes export) | 8 |
| DTRS-015 | Annual independent audit prep (data access logs, decision logs) | 3 |

## Epic: Operations Tooling (continued, ~30 pts)

| ID | Title | Pts |
|---|---|---|
| OPRT-006 | Public outcome dashboard (quarterly metrics, accessible to anyone) | 8 |
| OPRT-007 | Funder-portal generator (per-funder views into outcomes) | 5 |
| OPRT-008 | Steering Committee meeting templates + minutes recorder | 3 |
| OPRT-009 | FAG monthly meeting workflow + paid-time tracker | 5 |
| OPRT-010 | Press / external comms coordination (lock so single voice during crisis) | 3 |
| OPRT-011 | Crisis runbook one-click activation (per the Strategy Crisis Response page) | 8 |

---

# Phase 3 — Regional Scale (Sprints 39–47)

## Epic: Supply-Side Tools (~75 pts)

| ID | Title | Pts |
|---|---|---|
| SUPP-001 | Daviess County PVA assessor data ingestion | 8 |
| SUPP-002 | Owensboro Municipal Utilities data join (vacancy proxy) | 5 |
| SUPP-003 | Vacant property identification + mapping | 8 |
| SUPP-004 | ADU permitting walkthrough (Owensboro-specific) | 8 |
| SUPP-005 | Pre-approved builder directory + matching | 5 |
| SUPP-006 | Landlord registration + match-with-vetted-tenant flow | 8 |
| SUPP-007 | Coalition rent-guarantee fund integration (TEAMKY HRSN-backed) | 8 |
| SUPP-008 | Vacant commercial conversion suitability scoring | 8 |
| SUPP-009 | Faith-property conversion guidance (Diocese partnership) | 8 |
| SUPP-010 | Permitting status tracker (City of Owensboro integration) | 8 |
| SUPP-011 | Tenant readiness pipeline (transitional → permanent) | 5 |

## Epic: Policy & Intelligence (continued, ~60 pts)

| ID | Title | Pts |
|---|---|---|
| PCYI-001 | Quarterly Fiscal Court brief generator (1-page format) | 5 |
| PCYI-002 | Intervention efficacy report by subpopulation | 8 |
| PCYI-003 | Cost-per-outcome calculator (per intervention) | 5 |
| PCYI-004 | Public outcome dashboard expansion (drill-down by capability) | 5 |
| PCYI-005 | Policy simulation tool ("what if 25 PSH beds in east Owensboro?") | 13 |
| PCYI-006 | Cross-county benchmarking (KY BoS comparative) | 8 |
| PCYI-007 | KHC statewide demand forecast (BoS-wide) | 8 |
| PCYI-008 | Academic publication-ready outcomes export | 5 |
| PCYI-009 | Annual outcomes report with academic validation | 5 |

## Epic: Coordination (continued, ~10 pts)

| ID | Title | Pts |
|---|---|---|
| COOR-015 | Transportation coordination (NEMT + volunteer drivers) | 8 |
| COOR-016 | GRADD-region bed view (7 counties) | 5 |

## Epic: Subpopulation Pathways (Phase 3 set, ~25 pts)

| ID | Title | Pts |
|---|---|---|
| SUBP-008 | Older adults pathway (Medicare/Medicaid dual-eligible navigation) | 8 |
| SUBP-009 | LGBTQ+ youth pathway (affirming-only provider routing) | 5 |
| SUBP-010 | Rural hidden homeless pathway (signal correlation, outreach map) | 8 |

---

# Phase 4 — Full Vision (Sprints 48+)

Lower granularity — these are placeholders that will get story-level decomposition once we're approaching them.

## Epic: Replication & Open-Source (~40 pts)

| ID | Title | Pts |
|---|---|---|
| REPL-001 | Productized implementation playbook | 8 |
| REPL-002 | Technical migration kit (per-county Setup Wizard) | 13 |
| REPL-003 | Training curriculum + LMS | 8 |
| REPL-004 | Open-source license decision + repo split | 3 |
| REPL-005 | Public open-source maintenance workflow | 5 |
| REPL-006 | First peer-county adoption (e.g. McCracken / Paducah) | 3 |

## Epic: Full Vision (~50 pts)

| ID | Title | Pts |
|---|---|---|
| FULL-001 | Cross-signal household correlation (eviction + ED + school in one household) | 13 |
| FULL-002 | Spanish translation across all client surfaces | 8 |
| FULL-003 | ASL video for D/HoH users | 8 |
| FULL-004 | Voice-first companion (replace SMS for elder users) | 8 |
| FULL-005 | Multi-state architecture (TN, IN, WV adapters) | 13 |

---

## Risks and assumptions baked into this plan

These are explicit so we can revisit them as we learn:

- **Velocity:** Plan assumes near-full-time solo work at 13-21 points per 2-week sprint. At evenings/weekends pace (5-8 pts/sprint), the timeline doubles. Bo, you said hours aren't relevant — but watch this carefully so you don't promise external dates that depend on a velocity you're not actually hitting.

- **BAA timing for Phase 1 ED super-utilizer work:** Sprint 18 assumes BAA + FHIR access are both signed. If they aren't, ESUC slips. Plan an alternative use case to fill the gap (probably more CWT or INDC work).

- **Court docket access:** EVDT-001/002 spike could surface a non-trivial blocker (e.g., manual-only export from clerk's office). Budget +1-2 sprints if full automation isn't feasible.

- **Synthetic data stand-ins:** Caseworker Tools work in Phase 1 uses synthetic conversations. The story sizes assume that synthetic data is "good enough" to validate the AI pipelines. Real data will reveal gaps; expect ~10% rework when real intake conversations start flowing.

- **Solo dev burnout risk:** This plan covers ~24 months of near-full-time work. Realistically, plan in checkpoint moments where you reassess scope, hand off to a contractor, or pause for funding.

- **HIPAA migration mid-Phase 1:** Sprint 18's HIPAA migration is 13 pts and touches every layer. Budget +1 sprint of buffer.

- **Frontline Advisory Group co-design dependency:** Several stories depend on FAG sessions (CWT-024 triage tier definitions, INDC-017 consent UX, etc.). Coalition operations needs to actually have the FAG running by Sprint 12 or these stories block.

- **No story is sized larger than 13.** Anything larger has been broken into a spike + implementation, OR is a Phase 4 placeholder that will get split when it's closer.

---

## How to import this into GitHub Issues

When you're ready:

1. Create labels in your GitHub repo: `phase-0`, `phase-1`, `phase-2`, `phase-3`, `phase-4`, `epic:fnd`, `epic:evdt`, `epic:esuc`, `epic:cwt`, `epic:indc`, `epic:coor`, `epic:dtrs`, `epic:oprt`, `epic:prvn`, `epic:supp`, `epic:pcyi`, `epic:subp`, `epic:repl`, `epic:full`, plus `points:1` through `points:13`.

2. Create a GitHub Project (Beta) with custom fields: `Story Points` (number), `Sprint` (single-select 1-50+), `Phase` (single-select 0-4), `Epic` (single-select), `Status` (Todo / In Progress / Review / Done).

3. For each story above, create a GitHub Issue with:
   - Title: `[FND-001] Initialize Next.js 15 + TypeScript + Tailwind + shadcn/ui repo`
   - Body: copy the Notes column + acceptance criteria
   - Labels: phase + epic + point
   - Project field: assign Sprint, Phase, Epic, Story Points

4. Bulk-create script available on request (uses `gh` CLI to create issues from a YAML/JSON manifest).

---

*This plan is a working document. Update story estimates as you learn velocity. Add new stories as discovery surfaces them. Move stories between sprints as priorities shift. The only thing that should never move is what the coalition committed to externally — those are dates, not estimates.*
