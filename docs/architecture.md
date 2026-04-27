# Architecture — Daviess Coalition Platform

**Audience:** anyone (you, future-you, future-Claude, an eventual second engineer) trying to build a mental map of this codebase in under 10 minutes.

**Stance:** [modular monolith](adr/0001-modular-monolith.md). One Next.js app, one Postgres, eight domain folders, source-level boundaries enforced by `pnpm lint:boundaries`. We split a service only when there's a compliance or scale reason — not because the codebase has multiple domains.

---

## System layers

```mermaid
graph TB
  subgraph ext[External services]
    clerk[Clerk Auth]
    twilio[Twilio SMS]
    anthropic[Anthropic API]
    resend[Resend Email]
    inngest[Inngest Jobs]
  end

  subgraph app[Next.js app]
    routes[App routes / pages<br/>src/app/]
    actions[Server actions<br/>src/app/actions/]
    domains[Domain logic<br/>src/lib/{domain}/]
    prompts[AI prompts<br/>src/ai/prompts/]
    queries[DB queries<br/>src/db/queries/]
    schema[DB schema<br/>src/db/schema/]
  end

  pg[(Postgres<br/>Supabase → AWS RDS post-BAA)]

  clerk --> routes
  twilio --> routes
  routes --> actions
  actions --> domains
  domains --> prompts
  domains --> anthropic
  domains --> queries
  queries --> schema
  schema --> pg
  inngest --> domains
  domains --> resend
```

**Reading the layers:**
- **Routes + actions** = composition layer. Allowed to span domains; that's their job.
- **`src/lib/{domain}/`** = domain logic. Cross-domain imports are gated by ADR 0001.
- **`src/ai/prompts/`** = single source of truth for AI surfaces. No inline prompt strings anywhere else.
- **`src/db/{schema,queries}/`** = persistence. Drizzle ORM; flat schema today, schema-per-domain split deferred to ESUC-002.

---

## Domain dependency graph

```mermaid
graph LR
  coordination[coordination<br/>bed availability]
  dtrs[dtrs<br/>consent · DV-blind · rate-limit]
  eviction[eviction · EVDT]
  cwt[cwt · Caseworker Tools]
  esuc[esuc · ED Super-Utilizer]
  indc[indc · SMS Companion]
  coalition[coalition · ops + insights]
  oprt[oprt · transparency rollups]

  coalition --> coordination
  cwt --> coordination
  cwt --> dtrs
  esuc --> coordination
  esuc --> dtrs
  eviction --> dtrs
  indc --> coordination
  oprt --> coalition
  oprt --> coordination
  oprt --> cwt
  oprt --> esuc
  oprt --> eviction
  oprt --> indc
```

Mirrors the allow-list in `scripts/check-domain-boundaries.mts`. Anything not on this graph that tries to import across domains fails CI.

**Two leaf domains:** `coordination` (bed availability) and `dtrs` (consent + access policy). Everything else either consumes them or rolls up into `oprt`.

**Why `oprt` reaches into everything:** transparency / quarterly narrative is a read-only consumer of every domain's output. That's the one place the dependency graph fans wide on purpose.

---

## PHI fence

```mermaid
graph LR
  subgraph clean[Clean — never PHI]
    eviction2[eviction<br/>public court record]
    coordination2[coordination<br/>bed counts]
    coalition2[coalition<br/>aggregates]
    oprt2[oprt<br/>aggregates only]
    indc2[indc<br/>operational SMS]
  end

  subgraph fenced[PHI fence — synthetic-only pre-BAA]
    cwt2[cwt<br/>caseworker intake + notes]
    esuc2[esuc<br/>ED encounters + care plans]
    dtrs2[dtrs<br/>consent records]
  end

  fenced -.unblocked by ESUC-002.-> phi[Real PHI<br/>HIPAA endpoint<br/>AWS RDS<br/>schema-per-domain split]
```

**The rule** (per [global CLAUDE.md](../CLAUDE.md#the-hipaa--phi-fence--do-not-cross-it)):
- Pre-BAA: no real PHI in DB or AI prompts. Synthetic-only for `cwt`/`esuc`/`dtrs`.
- ESUC-002 (post-BAA): switches to HIPAA-eligible Anthropic endpoint, splits PHI tables to a dedicated Postgres schema with separate role grants.

**The de-id pipeline (#247)** is the strategic open ticket on this fence — it replaces the synthetic-data stub with a real de-identifier so production PHI can flow through extraction post-BAA.

---

## Phase-1 user journeys

### J1 — KLA attorney: filing → response packet

```mermaid
sequenceDiagram
  participant Cron as Inngest scheduler
  participant Scrape as eviction/sources
  participant Parse as eviction/parser
  participant Risk as eviction/risk-score
  participant Att as Attorney UI
  participant Pkt as eviction/response-packet
  participant Anthr as Anthropic

  Cron->>Scrape: daily docket scrape
  Scrape->>Parse: raw text
  Parse->>Risk: structured filings
  Risk->>Anthr: filing → risk score
  Att->>Pkt: "draft answer for filing X"
  Pkt->>Anthr: filing facts → answer markdown
  Pkt-->>Att: draft packet (status=draft)
  Att->>Pkt: review · edit · approve
  Pkt-->>Att: status=approved → PDF
```

### J2 — Caseworker: intake → benefits screening (synthetic)

```mermaid
sequenceDiagram
  participant CW as Caseworker UI
  participant Intake as cwt/intake-extraction
  participant Anthr as Anthropic
  participant Bnf as cwt/benefits
  participant Tri as cwt/triage

  CW->>Intake: free-form transcript
  Intake->>Anthr: transcript → structured fields
  Anthr-->>Intake: name · housing · benefits · risks
  Intake->>Bnf: structured intake
  Bnf-->>CW: KTAP · SNAP · KCHIP · KY HEALTH eligibility
  CW->>Tri: assign tier
  Tri->>Anthr: cohort · history → high/medium/low
  Tri-->>CW: tier + rationale
```

Pre-BAA: every "intake" here is synthetic (CWT-001 generator). Post-BAA: same flow, real client data, HIPAA endpoint.

### J3 — Unhoused individual: SMS bed-finder

```mermaid
sequenceDiagram
  participant U as User phone
  participant Tw as Twilio
  participant Hook as /api/webhooks/twilio
  participant Pipe as indc/sms-pipeline
  participant Bed as coordination/bed-availability
  participant Hold as indc/sms-bed-holds

  U->>Tw: "BED"
  Tw->>Hook: POST (signed)
  Hook->>Pipe: parse intent
  Pipe->>Bed: filter shelters
  Bed-->>Pipe: matching beds
  Pipe-->>Tw: bed list reply
  Tw-->>U: SMS

  U->>Tw: "HOLD Boulware"
  Tw->>Hook: POST
  Hook->>Hold: create hold (TTL)
  Hold-->>Tw: confirmation
  Tw-->>U: "Held until 8pm"
```

Twilio webhook signature verified via `indc/twilio-signature.ts` (S5 e2e). Bed-hold expiration enforced by Inngest scheduler, not a Postgres trigger.

---

## Tech stack reference

| Layer | Choice | Notes |
|---|---|---|
| Framework | Next.js 15 (App Router) + TypeScript strict | |
| ORM | Drizzle | Migrations in `drizzle/migrations/` |
| Auth | Clerk | Org/role-aware; middleware in `src/middleware.ts` |
| Database | Postgres (Supabase → AWS RDS post-BAA) | citext, triggers, RLS later |
| AI | Anthropic Claude (Sonnet 4.6 default) | HIPAA endpoint post-BAA |
| SMS | Twilio | HIPAA-eligible account post-BAA |
| Email | Resend | |
| Background jobs | Inngest | Daily scrapers, hold expiration, digests |
| Maps | Mapbox GL JS | |
| Observability | Sentry + PostHog | |
| Testing | Vitest (unit) + Playwright (e2e) | E2E DB on Docker Postgres |
| Lint | Biome + custom boundary lint | |
| Hosting | Railway (staging) → Vercel + AWS (prod post-BAA) | |

---

## Where to learn more

- **`STATE.md`** — current focus + what's open today.
- **Per-domain `src/lib/{domain}/CLAUDE.md`** — auto-loads when editing in that subdir.
- **`docs/adr/`** — decision records for established patterns.
- **`docs/access-control.md`** — role + partner-org policy details.
- **`docs/schema.md`** — schema-level documentation as it accumulates.
