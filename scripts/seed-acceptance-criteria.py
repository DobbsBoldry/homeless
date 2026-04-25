#!/usr/bin/env python3
"""Update FND-001..FND-009 GitHub issues with concrete acceptance criteria."""
import json
import re
import subprocess
import sys

REPO = "DobbsBoldry/homeless"

CRITERIA = {
    "FND-001": [
        "`pnpm create next-app@latest` with TS strict, Tailwind, App Router, `src/` dir",
        "Biome configured for lint + format (replaces ESLint/Prettier); `pnpm lint` passes",
        "shadcn/ui initialized (`pnpm dlx shadcn@latest init`) with default theme",
        "Base shadcn components added: button, card, input, label, dialog",
        "`pnpm dev` runs cleanly; `/` renders default page without errors",
        "`.env.example` checked in; `.env.local` git-ignored",
        "Branch merged to main; pushed to GitHub",
    ],
    "FND-002": [
        "Supabase project created; URL + anon + service keys documented in `.env.example`",
        "`drizzle.config.ts`, `src/db/schema/`, `src/db/client.ts` set up",
        "First migration creates `health_check` table (id uuid pk, created_at timestamptz)",
        "`pnpm db:generate` and `pnpm db:migrate` scripts work end-to-end",
        "Connection verified via `/api/health` route that selects from the table",
    ],
    "FND-003": [
        "Clerk app created; publishable + secret keys in `.env.example`",
        "`<ClerkProvider>` wraps the app; `/sign-in` and `/sign-up` routes work",
        "`middleware.ts` protects `/app/*` routes; `/` and marketing pages stay public",
        "On first sign-in, user row mirrored to Postgres `users` table (webhook or sign-in handler)",
        "Role enum defined: `attorney`, `caseworker`, `ed_coordinator`, `shelter_staff`, `admin`",
        "Default role on signup = `caseworker` (until invitation flow exists)",
    ],
    "FND-004": [
        "`.github/workflows/ci.yml` triggers on PR + push to main",
        "Pipeline steps: pnpm install (cached), `pnpm lint`, `pnpm typecheck`, `pnpm test`",
        "Branch protection on `main` requires CI status check to pass",
        "CI completes green on a sample PR",
    ],
    "FND-005": [
        "Railway project linked to GitHub repo; auto-deploys on push to main",
        "All env vars set in Railway (Supabase URL/keys, Clerk keys, Sentry DSN, etc.)",
        "Healthcheck endpoint reachable at the Railway URL",
        "URL added to repo About section + `README.md`",
        "Custom domain optional; HTTPS verified",
    ],
    "FND-006": [
        "Sentry: server + client SDKs installed; DSN in env",
        "Sentry verified: a test route deliberately throws and the error appears in the dashboard",
        "PostHog: browser + server SDKs initialized",
        "PostHog verified: `$pageview` event captured on home page load",
        "PII scrubbing configured (no email or full URL params in events)",
    ],
    "FND-007": [
        "App layout: top bar (org switcher placeholder, user menu) + left sidebar (role-aware nav) + main content area",
        "Tailwind config matches docs-site palette + typography (port tokens from `~/Documents/Claude/Projects/Homeless/`)",
        "Responsive: sidebar collapses below `md` breakpoint into a hamburger drawer",
        "Empty-state placeholder pages for: Dashboard, Cases, Clients, Settings",
        "Dark-mode toggle works (uses `next-themes` or shadcn pattern)",
        "Layout uses semantic HTML + ARIA landmarks (nav, main, header)",
    ],
    "FND-008": [
        "Drizzle schema files for: `users`, `partner_orgs`, `roles`, `org_memberships`, `audit_log`, `consents`",
        "Migrations generated and applied locally without errors",
        "Seed script creates: 1 partner org, 5 users (one per role), 3 sample audit entries",
        "Foreign keys + btree indexes on all FK columns",
        "`audit_log` capture: app-level helper (`logAuditEvent(actorId, action, target)`) used by at least one mutation",
        "Schema diagram added to `docs/schema.md` (mermaid or ascii)",
    ],
    "FND-009": [
        "Inngest client + local dev server configured (`pnpm inngest:dev`)",
        "One scheduled function: `daily-health-ping` (cron `0 9 * * *` UTC) — logs and writes to `health_check` table",
        "One event-driven function: `user.signed_up` triggered from Clerk webhook → logs payload",
        "Inngest Cloud account linked; functions visible in dashboard",
        "README has section on triggering events locally",
    ],
}


def get_issue(story_id):
    r = subprocess.run(
        ["gh", "issue", "list", "--repo", REPO, "--state", "open",
         "--search", f"[{story_id}] in:title", "--json", "number,title,body"],
        capture_output=True, text=True, check=True,
    )
    issues = json.loads(r.stdout)
    for i in issues:
        if f"[{story_id}]" in i["title"]:
            return i
    return None


def update_body(num, new_body):
    subprocess.run(
        ["gh", "issue", "edit", str(num), "--repo", REPO, "--body", new_body],
        check=True, capture_output=True,
    )


def main():
    for story_id, criteria in CRITERIA.items():
        issue = get_issue(story_id)
        if not issue:
            print(f"  {story_id}: NOT FOUND, skipping")
            continue
        body = issue["body"]
        # Replace the "## Acceptance criteria" section up to "---"
        new_ac = "## Acceptance criteria\n\n" + \
                 "\n".join(f"- [ ] {c}" for c in criteria) + \
                 "\n- [ ] passes Definition of Done (see CLAUDE.md)\n"
        new_body = re.sub(
            r"## Acceptance criteria\n\n.*?(?=\n---)",
            new_ac.rstrip() + "\n",
            body,
            flags=re.DOTALL,
        )
        update_body(issue["number"], new_body)
        print(f"  {story_id} (#{issue['number']}): updated with {len(criteria)} criteria")

    print("\nDone.")


if __name__ == "__main__":
    main()
