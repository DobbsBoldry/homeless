#!/usr/bin/env python3
"""Update Sprint 5 GitHub issues with concrete acceptance criteria.

Sprint 5 goal: ship a stakeholder-ready demo. Build axis weighted toward
making the eviction-defense pipeline usable end-to-end so Bo can get the
first KLA partner on board.
"""
import json
import re
import subprocess

REPO = "DobbsBoldry/homeless"

CRITERIA = {
    "EVDT-013": [
        "New page `/app/cases/filings/[id]/packet` (or a panel on the case-detail page) gated by `requireKlaAttorney()`",
        "Loads the latest packet via `getResponsePacket(filing.id)`; if none exists, shows a 'Generate packet' button that calls the EVDT-012 service",
        "Markdown rendered to HTML for review (use `react-markdown` or equivalent — keep it simple, no rich text editor in v1)",
        "Inline editing via a textarea swap on the packet markdown; save persists `packet_md` and bumps `updated_at`",
        "Status transitions: 'Approve' button (draft -> approved), 'Mark filed' (approved -> filed), 'Reject' (any -> rejected)",
        "All status changes write an audit_log entry via logAuditEvent (action: `response_packet.status_changed`)",
        "Disclaimer banner is always visible; cannot be edited away in the textarea",
        "Defendant full name visible on this page (attorney needs it for the answer caption); explicit click-through warning that this view contains the unredacted name",
    ],
    "EVDT-014": [
        "New table `rental_assistance_programs`: id, name, agency, phone, eligibility_summary, max_award_cents, active",
        "Static seed of 5-10 KY rental-assistance programs (KHC, KY HEALTH, Audubon Area, ER Brown grant, etc.) — synthetic OK if real eligibility text isn't easy to source",
        "Query `matchAssistancePrograms(filing): Promise<Program[]>` — for v1 returns ALL active programs (matching logic comes when we have real eligibility data)",
        "Display: a card on the case-detail page listing matching programs with name, phone, brief eligibility, max award",
        "Caveat banner: 'Eligibility depends on household specifics not in the filing — verify with the agency before referring.'",
    ],
    "EVDT-017": [
        "Status enum already exists on eviction_response_packets (draft|approved|filed|rejected). Add `outcome` enum on a new `eviction_case_outcomes` table: dismissed, judgment_for_plaintiff, judgment_for_defendant, settled, default_judgment, withdrawn",
        "Server action `recordCaseOutcome(filingId, outcome, attorneyUserId, notes?)` — writes one row per filing per outcome event",
        "Outcome capture UI on the case-detail page: dropdown + optional notes textarea + 'Record outcome' button (visible only to KLA attorneys)",
        "Outcome history table on the case-detail page: shows all recorded outcomes with timestamp + attorney name (for the audit trail)",
        "Outcomes appear in the EVDT-020 metrics dashboard",
        "Audit-log every outcome via logAuditEvent (action: `case.outcome_recorded`)",
    ],
    "EVDT-020": [
        "New page `/app/metrics` gated by `requireRole(['attorney', 'admin'])`",
        "Cards for: total filings ingested (last 30 days), filings with packet generated, packets approved, packets filed, outcomes recorded",
        "Outcome breakdown: representation rate (% of filings with at least one packet), default-judgment rate (% of filings with outcome=default_judgment), favorable-outcome rate (% with judgment_for_defendant or settled)",
        "Time-series chart: daily filing count + daily packets-approved count, last 30 days (use a lightweight chart lib — recharts or visx)",
        "All numbers are scoped to the current Phase 1 cohort (KLA Owensboro); when multi-org lands later this scopes per org",
        "Empty state: 'No outcomes recorded yet' with a link to the case-detail outcome capture",
    ],
    "EVDT-021": [
        "Server action `exportPacketPdf(packetId): Promise<{filename, bytes}>` returns a downloadable PDF",
        "Use a markdown -> PDF library (md-to-pdf, marked + puppeteer, or react-pdf) — keep it server-side; no browser deps in the client bundle",
        "PDF preserves the full disclaimer header, caption, response paragraphs, defenses checklist (rendered as filled or empty boxes), signature block",
        "Filename: `packet-{caseNumber}-{packetId}.pdf`",
        "Download button on the EVDT-013 packet review page; only enabled when status >= approved",
        "Audit-log every export via logAuditEvent (action: `response_packet.exported`)",
        "PDF generation is deterministic for the same packet_md (no timestamps in the body beyond the disclaimer)",
    ],
    "EVDT-022": [
        "**SLIM:** single-page handout / leave-behind, NOT a full manual",
        "Lives at `docs/kla-demo-handout.md` (Markdown) — convert to PDF via the EVDT-021 pipeline or pandoc",
        "1 page, 4 sections: (1) what the system does in 3 sentences, (2) the 5-step daily workflow with screenshots, (3) what's AI-drafted vs human-reviewed (the disclaimer story), (4) what we measure / what success looks like",
        "Owner: Bo writes content; engineering provides the screenshots from staging once Sprint 5 ships",
    ],
    "DEMO-001": [
        "(see issue body)",
    ],
    "ADMIN-001": [
        "(see issue body)",
    ],
}


def get_issue(story_id):
    r = subprocess.run(
        ["gh", "issue", "list", "--repo", REPO, "--state", "open",
         "--search", f"{story_id} in:title", "--json", "number,title,body", "--limit", "5"],
        check=True, capture_output=True, text=True,
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
        # DEMO-001 and ADMIN-001 already have full bodies; skip.
        if criteria == ["(see issue body)"]:
            print(f"  {story_id} (#{issue['number']}): kept (issue body has ACs)")
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
