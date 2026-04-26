#!/usr/bin/env python3
"""Update Sprint 4 GitHub issues with concrete acceptance criteria."""
import json
import re
import subprocess

REPO = "DobbsBoldry/homeless"

CRITERIA = {
    "EVDT-018": [
        "Seed script extends `src/db/seed.ts`: creates a `Kentucky Legal Aid - Owensboro` partner_org (slug `kla-owensboro`, type `legal_aid`) and assigns the seed `attorney` user to it via org_memberships",
        "New helper `requireKlaAttorney()` in `src/lib/auth.ts` — returns user only if (a) role=attorney AND (b) member of partner_org slug `kla-owensboro`. Otherwise notFound().",
        "Document the role mental model in `docs/access-control.md` (KLA staff vs other attorneys, Phase-1 single-org assumption)",
    ],
    "EVDT-010": [
        "Query `listRankedDocket(limit?)` in `src/db/queries/eviction-filings.ts` joining filings to their latest risk score, ordered by score DESC then filed_at DESC",
        "Filings without a score sort last (LEFT JOIN, COALESCE score=0)",
        "Returns `{filing, score, rationale}` rows so the dashboard can render without a second query",
        "Indexes: confirm risk_scores_score_idx is sufficient for the join",
        "Unit tests against the in-memory query layer (or DB integration test) — at least: 3 scored + 1 unscored filing returns 4 rows in correct order",
    ],
    "EVDT-015": [
        "New page at `/app/cases/queue` (sidebar nav: 'Daily queue', under Cases group)",
        "requireKlaAttorney() gate (EVDT-018)",
        "Server-rendered table from listRankedDocket(limit=50)",
        "Columns: rank #, score (color-banded), case#, defendant initials, plaintiff, cause, status, filed",
        "Filters as URL params: ?status=, ?cause=, ?min_score=",
        "Search box (case# or plaintiff substring; uses ILIKE)",
        "Empty state: 'No filings ingested yet — see Filings page'",
        "Each row links to /app/cases/filings/[id]",
    ],
    "EVDT-019": [
        "Inngest scheduled function `daily-attorney-digest` (cron `0 12 * * 1-5` UTC = 7am Central, weekdays)",
        "Sends one email via Resend per KLA attorney (looked up by partner_org membership)",
        "Email body: top-10 cases from listRankedDocket, markdown-rendered table",
        "Subject: '[Daviess Daily] N high-risk eviction cases for {date}'",
        "Plain-text fallback included; defendant initials only (full names need attorney click-through)",
        "RESEND_API_KEY env var added to .env.example + README",
        "Test recipient via `EVDT_DIGEST_TEST_EMAIL` env var override (skips DB lookup, sends to one address) — used during development before real attorneys are seeded",
        "Sentry captures send failures; doesn't break the cron",
    ],
    "EVDT-012": [
        "Service `generateResponsePacket(filing): Promise<{packet_md: string, version: string}>` in `src/lib/eviction/response-packet.ts`",
        "Claude API prompt at `src/ai/prompts/eviction-response-packet.ts` (no inline strings)",
        "Output is markdown: KY-specific Answer to Forcible Detainer Complaint shape (caption, paragraph-by-paragraph response, affirmative defenses checklist, signature block)",
        "Required disclaimer block at top: 'AI-DRAFTED — REVIEW BY LICENSED ATTORNEY REQUIRED BEFORE FILING. Generated {timestamp} model {version}.'",
        "Prompt includes 1-shot example of a well-formed answer (KY court template)",
        "New table `eviction_response_packets` (filing_id FK, packet_md, prompt_version, generated_by_user_id FK, status enum draft|approved|filed|rejected, created_at)",
        "Defendant address scrubbed from the prompt; defendant name kept (it's on the answer caption)",
        "Eval set: 5 hand-curated filings + expected-element checklist (caption, response paragraphs, defenses); harness in `scripts/eval-response-packet.ts`",
        "Idempotent: re-generating for the same (filing_id, prompt_version) returns cached packet",
    ],
    "EVDT-009a": [
        "/app/cases/filings/[id] reads latest score via getLatestScore(filing.id)",
        "Score panel: large color-banded number (green<40, amber 40-69, red 70+), rationale, model_version, scored_at",
        "If no score: 'Score this case' button calling a server action `scoreFilingAction(filingId)` in `src/app/actions/eviction.ts`",
        "Server action gated on CaseFilingsRoles allow-list",
        "Loading + error states on the button",
        "After score arrives, page revalidates to show it",
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
            print(f"  {story_id}: NOT FOUND")
            continue
        body = issue["body"]
        new_ac = "## Acceptance criteria\n\n" + \
                 "\n".join(f"- [ ] {c}" for c in criteria) + \
                 "\n- [ ] passes Definition of Done (see CLAUDE.md)\n"
        if "## Acceptance criteria" in body:
            new_body = re.sub(
                r"## Acceptance criteria\n\n.*?(?=\n---|$)",
                new_ac.rstrip() + "\n",
                body,
                flags=re.DOTALL,
            )
        else:
            new_body = body.rstrip() + "\n\n" + new_ac
        update_body(issue["number"], new_body)
        print(f"  {story_id} (#{issue['number']}): {len(criteria)} criteria")


if __name__ == "__main__":
    main()
