# Daviess Coalition Platform — Codebase Guide for Claude Code

You are working with **Bo** as a solo-developer engineering partner on the Daviess County, Kentucky coalition platform — an AI-powered system to address homelessness via eviction defense, ED super-utilizer care coordination, caseworker tooling, and a SMS individual companion. This file is your standing context. Read it on every session.

## Product context (one-paragraph version)

This platform serves a county-level homelessness coalition. It ingests public eviction filings, hospital ED super-utilizer signals, and shelter bed availability; uses Claude to risk-score, draft response packets, summarize cases, and route resources; and surfaces this through role-aware dashboards for attorneys, caseworkers, ED care coordinators, and shelter staff, plus an SMS interface for unhoused individuals.

**Sister docs repo:** the deployed documentation site (Pilot Plan, Product Vision, Strategy) lives at `~/Documents/Claude/Projects/Homeless/` and is hosted on Railway. Read `product-vision/`, `strategy/`, and `Daviess_Pilot_Overview.html` there for the full product narrative — those are the source of truth for *what* this platform does and *why*. This repo (`~/git/homeless/`) is the *how* — the actual code.

## Architecture (planned — not all built yet)

| Layer | Tech | State |
|---|---|---|
| Framework | Next.js 15 (App Router) + TypeScript | Planned, FND-001 |
| Styling | Tailwind CSS + shadcn/ui | Planned, FND-001 |
| Database | PostgreSQL via Supabase → AWS RDS post-BAA | Planned, FND-002 |
| ORM | Drizzle | Planned, FND-002 |
| Auth | Clerk (orgs/roles/SSO) | Planned, FND-003 |
| AI | Anthropic Claude API (Sonnet 4.6 default, Opus 4.6 reasoning, HIPAA endpoint post-BAA) | Planned |
| SMS / voice | Twilio (HIPAA-eligible account post-BAA) | Planned |
| Email | Resend | Planned |
| Background jobs | Inngest | Planned, FND-009 |
| Maps | Mapbox GL JS | Planned |
| Observability | Sentry (errors) + PostHog (product analytics) | Planned, FND-006 |
| Hosting | Railway (staging) → Vercel + AWS (prod, post-BAA) | Planned, FND-005 |
| File storage | Supabase Storage → S3 post-BAA | Planned |
| Package manager | pnpm | Planned |
| CI/CD | GitHub Actions (lint, typecheck, test) | Planned, FND-004 |

## How to read this codebase

- **`BACKLOG.md`** — the source of truth for what to build, in what order, with story-point estimates. Read it any time you're picking up new work.
- **`docs/`** — architecture decisions, ADRs, schema diagrams as they accumulate.
- **`README.md`** — local development setup.
- **`scripts/`** — operational scripts (GitHub setup, data imports, etc.). Not application code.
- **`src/`** — Next.js application code (created by FND-001).

## Conventions

### Code style
- TypeScript strict mode on. No `any` without `// reason: ...` comment.
- Biome for formatting + linting (single tool, fast). Configure in FND-001.
- 2-space indent. Trailing commas. Single quotes in TS, double in JSX.
- Named exports preferred over default exports for components and utilities.

### File organization
- Next.js App Router structure under `src/app/`
- Shared UI primitives in `src/components/ui/` (shadcn/ui copy-ins)
- Domain components in `src/components/{domain}/` (e.g. `src/components/eviction/`)
- Server actions in `src/app/actions/{domain}.ts`
- Database schema and queries in `src/db/schema/{table}.ts` and `src/db/queries/{domain}.ts`
- Drizzle migrations in `drizzle/` (generated)
- AI prompts in `src/ai/prompts/{capability}.ts` — single source of truth, never inline strings

### Naming
- Files: kebab-case (`eviction-filing.ts`)
- Types/interfaces: PascalCase (`EvictionFiling`)
- Functions/variables: camelCase
- Database tables: snake_case, plural (`eviction_filings`)
- Story IDs in commits and branch names use the BACKLOG ID exactly (`FND-001`, not `fnd-1`)

### Branch and PR strategy
- `main` = always deployable to staging
- Feature branches: `phase{N}/{epic-prefix}-{ticket-num}-{slug}` (e.g. `phase1/EVDT-007-risk-scoring`)
- Squash-merge to main
- PR description includes the ticket ID and a checklist of acceptance criteria
- Conventional Commits format: `feat(EVDT-007): add risk scoring service` / `fix(FND-002): correct migration ordering`

### Definition of Ready (a story can enter a sprint)
- Acceptance criteria written
- Dependencies identified and not blocked
- Tech approach roughly known (or there's an explicit spike story)
- Sized at 8 points or below — 13s get split first

### Definition of Done (a story is shippable)
- Code merged to main
- All acceptance criteria pass manual verification
- At least one happy-path test (when code touches data flow)
- Updated relevant docs (README, schema, API)
- Deployed to staging
- No new Sentry errors

## The HIPAA / PHI fence — DO NOT CROSS IT

Until the BAA with Owensboro Health is signed and the HIPAA infrastructure migration (ESUC-002) is complete:

- **No real PHI lands in the database.** Period.
- **No real PHI flows through any AI prompt.**
- All Phase 1 caseworker/AI work runs on **synthetic data only** (CWT-001 generates this).
- All eviction filing data is public court record — that's fine.
- All bed availability, partner registry, decision log, etc. is non-PHI — that's fine.

If a story is about to introduce a real PHI flow before the BAA is signed, **stop and flag it.** That's a sequencing bug.

## Working with Bo

- Bo is the only developer. Be autonomous within a single story: branch, code, test, commit, show diff. Don't ask for permission step-by-step.
- Show the plan before coding (1-3 sentences) for stories ≥ 5 points. For 1-3 point stories, just do it.
- When you finish a story, summarize what changed in 2-4 bullet points and ask for review of the diff. Don't auto-merge.
- If a story turns out to be sized wrong (was 5, actually 13), say so explicitly and propose a split instead of grinding through.
- Bo prefers terse responses. No trailing summaries of what you just did. The diff and the commit message are the summary.
- If something feels off (architecture smell, missing acceptance criterion, wrong sequencing), push back. Don't just execute.

## Cross-references

- Sister docs repo (deployed at Railway): `~/Documents/Claude/Projects/Homeless/` containing `product-vision/`, `strategy/`, and the Pilot Overview HTML
- Product vision pages map roughly 1:1 to engineering epics (eviction-defense → EVDT, super-utilizer → ESUC, etc.)
- Strategy pages cover non-engineering work (partnerships, funding, comms, crisis runbooks)

## First task

**FND-001: Initialize Next.js 15 + TypeScript + Tailwind + shadcn/ui repo**

After GitHub setup is complete and this CLAUDE.md is in place, your first task is FND-001. Branch from main as `phase0/FND-001-init-nextjs`, scaffold the app with `pnpm create next-app@latest`, configure Biome, install shadcn/ui base components, commit, and open a PR.
