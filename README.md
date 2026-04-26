# Daviess Coalition Platform

AI-powered platform for the Daviess County, Kentucky coalition pilot to address homelessness via eviction defense, ED super-utilizer care coordination, caseworker tooling, and an SMS individual companion.

**Repo:** [github.com/DobbsBoldry/homeless](https://github.com/DobbsBoldry/homeless)

**Staging:** [homeless-production.up.railway.app](https://homeless-production.up.railway.app) — auto-deploys on push to `main`

**Status:** Sprint 1 wrapping (Phase 0 foundation). Application scaffolded and deployed to staging via Railway as stories land.

**Sister docs repo:** the documentation site (Pilot Plan, Product Vision, Strategy) lives separately at `~/Documents/Claude/Projects/Homeless/` and is deployed to Railway.

## Quick start

```bash
pnpm install
cp .env.example .env.local       # fill in Supabase + Clerk keys (see comments)
pnpm db:migrate                  # apply Drizzle migrations to your Supabase DB
pnpm db:seed                     # idempotent — seeds 1 org + 5 users + 3 audit rows
pnpm dev                         # http://localhost:3000

# In a second terminal, for background jobs:
pnpm inngest:dev                 # http://localhost:8288 (Inngest dev UI)
```

### Triggering Inngest events locally

The Inngest dev server auto-discovers functions exposed at `/api/inngest`.
With both `pnpm dev` and `pnpm inngest:dev` running, events fired from the
app (e.g. by the Clerk webhook on `user.created`) will appear in the dev UI
and run their handlers locally. To send a one-off test event:

```ts
import { inngest } from '@/inngest/client';
await inngest.send({ name: 'user.signed_up', data: { clerkUserId: 'test_123' } });
```

The scheduled `daily-health-ping` (cron `0 9 * * *` UTC) can be invoked
on-demand from the dev UI without waiting for the cron.

### Generating synthetic test data

We never use real PHI or real eviction-defendant data in development. The
`scripts/gen-synthetic-*.ts` scripts use the Claude API to produce realistic
fixtures we can iterate against safely.

```bash
# Eviction filings (Daviess District Court shape — public record domain)
pnpm tsx scripts/gen-synthetic-filings.ts --count 50 --out fixtures/eviction-filings.json
pnpm tsx scripts/gen-synthetic-filings.ts --count 10 --seed 42 --out fixtures/sample.json

# Shelter-intake conversation transcripts (CWT + INDC test foundation)
pnpm tsx scripts/gen-synthetic-intake.ts --count 10 --out fixtures/intakes.json
```

Generated rows are clearly labelled synthetic — case numbers prefixed `SYN-`,
intake IDs prefixed `SYN-INT-`, fake-dictionary names (`Synthwell`, `Fakeman`,
etc.), no real Daviess addresses, RFC-reserved fictional phone numbers
(555-01XX). Safe to commit; safe to load into the staging DB.

Baseline fixtures (committed so contributors don't all need API credits):
- `fixtures/eviction-filings.json` — 50 filings, seed=42
- `fixtures/intakes.json` — 10 intakes, seed=42

## Set up GitHub (one time)

This bulk-creates the repo, labels, milestones, project board, and ~180 issues from `BACKLOG.md`.

**Prerequisites:**
1. Install GitHub CLI: `brew install gh` (or see https://cli.github.com)
2. Authenticate: `gh auth login` — pick GitHub.com, HTTPS, paste token (or web flow)
3. Confirm you have `gh project` access (free for personal accounts; project v2 enabled by default)

**Run setup:**
```bash
cd ~/git/homeless
./scripts/setup-github.sh
```

The script defaults to **`DobbsBoldry/homeless`** (the canonical repo, already created). Override with `--repo OWNER/NAME` if running against a fork or test repo.

It will then:
1. Skip repo creation (the repo already exists)
2. Create labels: `phase-0` through `phase-4`, `epic:fnd` etc, `points:1` through `points:13`, plus a few utility labels
3. Create milestones (one per phase)
4. Create a Project (v2) with custom fields: Story Points, Sprint, Phase, Epic, Status
5. Create all issues from `BACKLOG.md` with appropriate labels and milestone
6. Add issues to the project and set custom fields

This is idempotent — re-running skips items that already exist.

## Tech stack (planned)

See `CLAUDE.md` for the full stack table. Short version: Next.js 15 + TypeScript + Tailwind + shadcn/ui + Supabase Postgres + Drizzle + Clerk + Claude API + Twilio + Resend + Inngest + Mapbox + Sentry + PostHog. Hosted on Railway → Vercel + AWS once HIPAA work begins.

## Deployment

`main` auto-deploys to Railway staging at
[homeless-production.up.railway.app](https://homeless-production.up.railway.app).
Env vars live in the Railway dashboard (Variables tab). The full set is
enumerated in `.env.example`. Branch protection on `main` requires the `ci`
status check to pass.

To verify a deploy:
```bash
curl https://homeless-production.up.railway.app/api/health
```
Should return `{ "ok": true, ... }` and increment `totalPings`.

## Working with Claude Code

This repo is set up for solo development with Claude Code as the engineering partner.

```bash
cd ~/git/homeless
claude
```

On the first session, give Claude this prompt:

> Read `CLAUDE.md` and `BACKLOG.md`. I'm starting Sprint 1. Walk through FND-001 (scaffold the Next.js app), then we'll do FND-002 next. Branch from main, scaffold, run setup, commit, open a PR. I'll review.

## Contributing

There's only one contributor right now (Bo). Conventions:
- Branch: `phase{N}/{epic-prefix}-{ticket-num}-{slug}`
- Conventional Commits
- Squash-merge to main
- PR description references the issue (e.g. `Closes #12`) and includes a checked-off acceptance-criteria list

## License

TBD. Probably MIT or AGPL once we're public-facing.
