# Daviess Coalition Platform

AI-powered platform for the Daviess County, Kentucky coalition pilot to address homelessness via eviction defense, ED super-utilizer care coordination, caseworker tooling, and an SMS individual companion.

**Status:** Pre-Sprint 1. Repo scaffolded, GitHub Issues seeded from `BACKLOG.md`. Application code begins with story FND-001.

**Sister docs repo:** the documentation site (Pilot Plan, Product Vision, Strategy) lives separately at `~/Documents/Claude/Projects/Homeless/` and is deployed to Railway.

## Quick start

```bash
# After Sprint 1 ships, this section will read:
# pnpm install
# cp .env.example .env.local  # fill in keys
# pnpm dev
```

For now, the only "code" here is the scaffolding to set up GitHub. See `scripts/` below.

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

The script will prompt for:
- GitHub username or org (default: your authenticated user)
- Repo name (default: `daviess-coalition-platform`)
- Repo visibility (default: private)

It will then:
1. Create the GitHub repo (or skip if it exists)
2. Create labels: `phase-0` through `phase-4`, `epic:fnd` etc, `points:1` through `points:13`, plus a few utility labels
3. Create milestones (one per phase)
4. Create a Project (v2) with custom fields: Story Points, Sprint, Phase, Epic, Status
5. Create all issues from `BACKLOG.md` with appropriate labels and milestone
6. Add issues to the project and set custom fields

This is idempotent — re-running skips items that already exist.

## Tech stack (planned)

See `CLAUDE.md` for the full stack table. Short version: Next.js 15 + TypeScript + Tailwind + shadcn/ui + Supabase Postgres + Drizzle + Clerk + Claude API + Twilio + Resend + Inngest + Mapbox + Sentry + PostHog. Hosted on Railway → Vercel + AWS once HIPAA work begins.

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
