#!/usr/bin/env python3
"""Update Sprint 3 GitHub issues with concrete acceptance criteria."""
import json
import re
import subprocess

REPO = "DobbsBoldry/homeless"

CRITERIA = {
    "EVDT-001": [
        "Memo at `docs/research/ky-courtnet-access.md` covering at least 3 access mechanisms",
        "Each mechanism rated on: cost, latency to integration, ongoing maintenance burden, legal/TOS posture, data freshness",
        "Recommended path with 1-paragraph justification + name of the next concrete step",
        "Cite all sources (URLs, docs, statutes) — KY AOC, eFiling site, vendor docs",
        "Surface anything that could derail us (vendor lock-in, cost surprises, throttling, terms of use)",
    ],
    "EVDT-002": [
        "Outreach playbook at `docs/research/daviess-clerk-outreach.md`",
        "Includes: name + title of who to call, phone number, suggested days/times, alternative contact methods",
        "5 questions to get answered (see template — feasibility of daily export, format, contact person, fee structure, escalation path)",
        "Email follow-up template (paste-and-send) for after the call",
        "1 phone call by Bo to the Daviess District Court Clerk's office",
        "Capture answers in `docs/research/daviess-clerk-outreach-result.md` (template stub committed)",
    ],
    "EVDT-005": [
        "Inngest scheduled function `daily-courtnet-scrape` (cron `0 12 * * *` UTC = 7am Central)",
        "Source abstraction in `src/lib/eviction/sources/` — `fetchTodaysDocket(): Promise<RawFiling[]>` interface",
        "Mock implementation `sources/courtnet-mock.ts` reads from `fixtures/eviction-filings.json` (rotates filed_at to today)",
        "Real CourtNet implementation `sources/courtnet.ts` is a stub returning empty + comment pointing at EVDT-001's recommended path",
        "Source selected via `EVICTION_SOURCE` env var: `mock` (default) | `courtnet`",
        "Each fetched record runs through `parseEvictionFiling()` (EVDT-006); successes insert via dedup logic (EVDT-007); ParseErrors logged + counted",
        "Inngest function reports a structured summary: `{ fetched, inserted, updated, parse_errors }`",
        "Sentry breadcrumb on every run; `Sentry.captureMessage('warning')` if `parse_errors > 5%` of fetched",
    ],
    "EVDT-007": [
        "`upsertFiling(filing): { action: 'inserted'|'updated'|'unchanged' }` in `src/lib/eviction/upsert.ts`",
        "Same `case_number + source` -> ON CONFLICT DO UPDATE if any of: status, amount, address changed; otherwise unchanged",
        "Cross-source preference: courtnet > manual > synthetic (don't let synthetic clobber a real row)",
        "Atomic per-row (single transaction; safe under concurrent scraper runs)",
        "Unit tests in `upsert.test.ts`: insert new, update on status change, no-op on identical, courtnet wins over synthetic for same case_number",
    ],
    "EVDT-009": [
        "Risk score service `src/lib/eviction/risk-score.ts`: `scoreFiling(filing): Promise<{ score: 0-100, rationale: string, version: string }>`",
        "Claude API call with prompt at `src/ai/prompts/eviction-risk-score.ts` (no inline strings)",
        "Prompt-cached system prompt; per-filing user prompt with structured filing facts only (no PHI patterns)",
        "Eval set: 20 historical-style filings in `fixtures/risk-score-eval.json` with expected-band labels (low/med/high)",
        "Eval harness `scripts/eval-risk-score.ts`: runs all 20, reports % within expected band + score distribution",
        "Schema additions: `eviction_filing_risk_scores` table (filing_id FK, score, rationale, model_version, created_at)",
        "Idempotency: re-scoring the same filing with the same model_version returns the cached score",
        "Defendant names/addresses scrubbed before sending to the model (eviction filings are public record but we still don't need them in the AI prompt)",
    ],
    "EVDT-016": [
        "Server-rendered page at `/app/cases/filings/[id]` (admin + attorney + caseworker via requireRole)",
        "Shows: case header (number, plaintiff, status badge), filing facts panel (defendant initials/full toggle, address, cause, amount, court division, filed date), risk score panel (if EVDT-009 has scored it), raw_json drawer for debugging",
        "Back link to `/app/cases/filings`",
        "Each row in the EVDT-008 dashboard becomes a Link to `/app/cases/filings/[id]`",
        "404 if the id doesn't exist",
        "No edit actions yet (lands in EVDT-017)",
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
        new_body = re.sub(
            r"## Acceptance criteria\n\n.*?(?=\n---)",
            new_ac.rstrip() + "\n",
            body,
            flags=re.DOTALL,
        )
        update_body(issue["number"], new_body)
        print(f"  {story_id} (#{issue['number']}): {len(criteria)} criteria")


if __name__ == "__main__":
    main()
