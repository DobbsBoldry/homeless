#!/usr/bin/env python3
"""Update Sprint 2 GitHub issues with concrete acceptance criteria."""
import json
import re
import subprocess
import sys

REPO = "DobbsBoldry/homeless"

CRITERIA = {
    "EVDT-004": [
        "Drizzle schema `eviction_filings` (snake_case plural per CLAUDE.md)",
        "Columns: id (uuid pk), case_number (text, unique), filed_at (timestamptz), court_division (text), plaintiff (text), defendant_first_name, defendant_last_name, defendant_address (text, nullable), cause_type (enum: non_payment, lease_violation, holdover, other), amount_claimed_cents (integer, nullable), status (enum: filed, served, judgment, dismissed, sealed), source (text — e.g. 'courtnet', 'manual', 'synthetic'), raw_json (jsonb), created_at, updated_at",
        "New enum: `eviction_cause_type` and `eviction_filing_status`",
        "Indexes: unique on (case_number, source); btree on filed_at, status",
        "Migration generated + applied; types exported from `src/db/schema/eviction-filings.ts`",
        "Schema diagram updated in `docs/schema.md`",
    ],
    "EVDT-006": [
        "Pure function `parseEvictionFiling(raw): ParsedFiling | ParseError` in `src/lib/eviction/parser.ts`",
        "Handles the synthetic shape produced by EVDT-024",
        "Extracts: case number, filed_at, plaintiff, defendant first/last, defendant address, cause type, amount claimed (cents), status",
        "Returns structured ParseError (not throw) on missing/malformed fields with field-level reasons",
        "Unit tests in `src/lib/eviction/parser.test.ts` covering: happy path, each cause type, missing fields, malformed dates, sealed/redacted records",
        "Test runner: `pnpm test` runs vitest (replaces stub script from FND-001)",
        "Parses the full EVDT-024 fixture file (50 records) with <2 ParseErrors",
    ],
    "EVDT-008": [
        "New protected page at `/app/cases/filings` (admin + attorney + caseworker)",
        "Server-rendered table of the most recent 50 filings (descending by filed_at)",
        "Columns: case number, filed at, plaintiff, defendant (initials only by default — toggle 'show full names' button for authorized roles), cause type, amount, status",
        "Empty state: 'No filings ingested yet — run `pnpm tsx scripts/load-fixtures.ts` to seed synthetic data'",
        "Source filter pills: All / synthetic / courtnet / manual (defaults to All)",
        "Linked from sidebar nav under 'Cases > Filings' (rename existing 'Cases' nav)",
        "No PHI/PII export; no row-click action yet (case detail comes in EVDT-016)",
    ],
    "CWT-001": [
        "CLI: `pnpm tsx scripts/gen-synthetic-intake.ts --count 20 --out fixtures/intakes.json`",
        "Generates realistic shelter-intake conversation transcripts via Claude API",
        "Conversation shape: array of { role: 'caseworker' | 'client', text: string, timestamp } turns",
        "Diversity: presenting issues (eviction, ED super-utilizer, family separation, mental health, substance use, working poor), household compositions, urgency levels",
        "Reproducible with `--seed N`",
        "AI prompt in `src/ai/prompts/synthetic-intake.ts` (per CLAUDE.md convention — no inline prompt strings)",
        "All names + addresses synthetic (clearly fake — e.g. 'Synth-Smith', 'Fake-Drive')",
        "README: 'Generating synthetic test data' section gains intake bullet alongside filings",
        "Anthropic API key wired via `process.env.ANTHROPIC_API_KEY` (added to .env.example)",
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
