#!/usr/bin/env python3
"""
setup-github.py — bulk-create GitHub repo, labels, milestones, and issues
from BACKLOG.md.

Idempotent: re-running skips items that already exist.

Usage:
    python3 scripts/setup-github.py [options]

Options:
    --repo OWNER/NAME       Target repo (default: <gh-user>/daviess-coalition-platform)
    --visibility VIS        public or private (default: private)
    --dry-run               Print what would happen without making changes
    --skip-repo             Skip repo creation
    --skip-labels           Skip label creation
    --skip-milestones       Skip milestone creation
    --skip-issues           Skip issue creation

Prereqs:
    - gh CLI installed and authenticated (`gh auth login`)
    - BACKLOG.md in the repo root
"""

import argparse
import json
import re
import subprocess
import sys
import time
from pathlib import Path

BACKLOG_PATH = Path(__file__).parent.parent / "BACKLOG.md"

EPIC_NAMES = {
    "FND":  "Foundation & Infrastructure",
    "EVDT": "Eviction Defense Triage",
    "ESUC": "ED Super-Utilizer Care Coordination",
    "CWT":  "Caseworker Tools",
    "INDC": "Individual Companion",
    "COOR": "Inter-Agency Coordination",
    "PRVN": "Prevention & Early Detection",
    "DTRS": "Data Trust & Compliance",
    "OPRT": "Coalition Operations Tooling",
    "PCYI": "Policy & Intelligence",
    "SUPP": "Supply-Side Tools",
    "SUBP": "Subpopulation Pathways",
    "REPL": "Replication & Open-Source",
    "FULL": "Full Vision",
}

PHASES = [0, 1, 2, 3, 4]
POINTS = [1, 2, 3, 5, 8, 13]

PHASE_TO_MILESTONE = {
    0: "Phase 0 — Foundation",
    1: "Phase 1 — Prove It",
    2: "Phase 2 — Trust and Expand",
    3: "Phase 3 — Regional Scale",
    4: "Phase 4 — Full Vision",
}

MILESTONE_DESCRIPTIONS = {
    "Phase 0 — Foundation":         "Coalition relationship-building parallel-track. Sprints 1-5. Repo bootstrap, design system, coalition operations starter, eviction docket research spike, daily ingestion pipeline.",
    "Phase 1 — Prove It":           "Eviction Defense + ED Super-Utilizer + Caseworker MVP + SMS Companion. Sprints 6-22. Two flagship use cases live with real users.",
    "Phase 2 — Trust and Expand":   "Cross-agency, faith-based opt-in, school early warning, full feature set. Sprints 23-38.",
    "Phase 3 — Regional Scale":     "Supply-side tools, policy & intelligence, regional expansion. Sprints 39-47.",
    "Phase 4 — Full Vision":        "Replication kit, multilingual, voice, multi-state. Sprints 48+.",
}

LABEL_DEFS = {
    # Phase
    "phase-0": ("0E8A16", "Phase 0 — Foundation"),
    "phase-1": ("1F75CB", "Phase 1 — Prove It"),
    "phase-2": ("A371F7", "Phase 2 — Trust and Expand"),
    "phase-3": ("D93F0B", "Phase 3 — Regional Scale"),
    "phase-4": ("5319E7", "Phase 4 — Full Vision"),
    # Epic
    "epic:fnd":  ("EDEDED", EPIC_NAMES["FND"]),
    "epic:evdt": ("F9D0C4", EPIC_NAMES["EVDT"]),
    "epic:esuc": ("C5DEF5", EPIC_NAMES["ESUC"]),
    "epic:cwt":  ("FEF2C0", EPIC_NAMES["CWT"]),
    "epic:indc": ("D4C5F9", EPIC_NAMES["INDC"]),
    "epic:coor": ("BFDADC", EPIC_NAMES["COOR"]),
    "epic:prvn": ("FAD8C7", EPIC_NAMES["PRVN"]),
    "epic:dtrs": ("FBCA04", EPIC_NAMES["DTRS"]),
    "epic:oprt": ("C2E0C6", EPIC_NAMES["OPRT"]),
    "epic:pcyi": ("E99695", EPIC_NAMES["PCYI"]),
    "epic:supp": ("0E8A16", EPIC_NAMES["SUPP"]),
    "epic:subp": ("F0AE3F", EPIC_NAMES["SUBP"]),
    "epic:repl": ("BFD4F2", EPIC_NAMES["REPL"]),
    "epic:full": ("5319E7", EPIC_NAMES["FULL"]),
    # Points
    "points:1":  ("EEEEEE", "1 story point — trivial"),
    "points:2":  ("CCCCCC", "2 story points — small"),
    "points:3":  ("AAAAAA", "3 story points — real story"),
    "points:5":  ("888888", "5 story points — standard"),
    "points:8":  ("666666", "8 story points — big"),
    "points:13": ("B60205", "13 story points — too big, split before sprint"),
    # Utility
    "spike":             ("D4C5F9", "Research / discovery story"),
    "blocked-on-baa":    ("B60205", "Blocked on Owensboro Health BAA"),
    "phase-1-milestone": ("FBCA04", "Marks a Phase 1 milestone reached"),
    "good-first-task":   ("7057FF", "Good place to start a Claude Code session"),
}


# ------- gh CLI wrapper -------

def gh(*args, capture=True, check=True):
    cmd = ["gh", *args]
    result = subprocess.run(cmd, capture_output=capture, text=True)
    if check and result.returncode != 0:
        sys.stderr.write(f"\nERROR: {' '.join(cmd)}\n")
        sys.stderr.write(f"stderr: {result.stderr}\n")
        sys.exit(1)
    return result


def gh_check_auth():
    r = gh("auth", "status", check=False)
    if r.returncode != 0:
        print("ERROR: gh CLI is not authenticated. Run `gh auth login` first.", file=sys.stderr)
        sys.exit(1)


# ------- backlog parser -------

# Story row matches both 4-column tables (Phase 0/1, with Notes) and
# 3-column tables (Phase 2/3/4 epic-listed, no Notes).
STORY_ROW_RE = re.compile(
    r"^\|\s*([A-Z]{3,4})-(\d{3})\s*"
    r"\|\s*(.+?)\s*"
    r"\|\s*([\d—\-]+)\s*"
    r"(?:\|\s*(.*?)\s*)?"
    r"\|\s*$"
)


def parse_backlog(path: Path):
    text = path.read_text()
    stories = []
    seen_ids = set()
    current_phase = None
    current_sprint = None

    for line in text.splitlines():
        # Phase: "# Phase N — ..."
        m = re.match(r"^# Phase (\d) [—-]", line)
        if m:
            current_phase = int(m.group(1))
            current_sprint = None
            continue
        # Sprint: "## Sprint N: ..." or "## Sprint N-N: ..."
        m = re.match(r"^## Sprint (\d+(?:-\d+)?)\b", line)
        if m:
            current_sprint = m.group(1)
            continue
        # Sub-sprint: "### Sprint N..."
        m = re.match(r"^### Sprint (\d+)\b", line)
        if m:
            current_sprint = m.group(1)
            continue
        # Epic section: "## Epic: Foo"  (Phase 2-4 stories grouped without sprint)
        m = re.match(r"^## Epic: ", line)
        if m:
            current_sprint = None
            continue
        # Story row
        m = STORY_ROW_RE.match(line)
        if m and current_phase is not None:
            epic = m.group(1)
            num = m.group(2)
            story_id = f"{epic}-{num}"
            # Skip duplicates from re-parsing (shouldn't happen but be safe)
            if story_id in seen_ids:
                continue
            seen_ids.add(story_id)
            title = m.group(3).strip()
            points_raw = m.group(4).strip()
            notes = (m.group(5) or "").strip()
            try:
                points = int(points_raw)
            except ValueError:
                points = None  # non-coding stories like ESUC-001 (BAA signed)
            stories.append({
                "id": story_id,
                "epic": epic,
                "title": title,
                "points": points,
                "phase": current_phase,
                "sprint": current_sprint,
                "notes": notes,
            })
    return stories


# ------- repo / labels / milestones / issues -------

def ensure_repo(owner: str, name: str, visibility: str, dry_run: bool):
    full = f"{owner}/{name}"
    print(f">> Repo {full}")
    r = gh("repo", "view", full, "--json", "name", check=False)
    if r.returncode == 0:
        print(f"   exists")
        return full
    print(f"   creating ({visibility})")
    if dry_run:
        return full
    flag = "--public" if visibility == "public" else "--private"
    gh("repo", "create", full, flag,
       "--description",
       "AI-powered coalition platform for Daviess County, KY homelessness response",
       "--disable-wiki")
    return full


def ensure_labels(repo: str, dry_run: bool):
    print(f">> Labels")
    r = gh("label", "list", "--repo", repo, "--limit", "500", "--json", "name")
    existing = {l["name"] for l in json.loads(r.stdout or "[]")}
    added = 0
    for name, (color, desc) in LABEL_DEFS.items():
        if name in existing:
            continue
        print(f"   add   {name}")
        if not dry_run:
            gh("label", "create", name, "--repo", repo, "--color", color, "--description", desc)
        added += 1
    print(f"   {added} added, {len(LABEL_DEFS) - added} already existed")


def ensure_milestones(repo: str, dry_run: bool):
    print(f">> Milestones")
    r = gh("api", f"repos/{repo}/milestones?state=all&per_page=100")
    existing = {m["title"]: m["number"] for m in json.loads(r.stdout or "[]")}
    nums = dict(existing)
    for title, desc in MILESTONE_DESCRIPTIONS.items():
        if title in existing:
            continue
        print(f"   add   {title}")
        if dry_run:
            nums[title] = -1
            continue
        r = gh("api", "--method", "POST", f"repos/{repo}/milestones",
               "-f", f"title={title}",
               "-f", f"description={desc}",
               "-f", "state=open")
        nums[title] = json.loads(r.stdout)["number"]
    return nums


def ensure_issues(repo: str, stories, milestone_nums, dry_run: bool):
    print(f">> Issues ({len(stories)} stories)")
    r = gh("issue", "list", "--repo", repo, "--limit", "500", "--state", "all",
           "--json", "title,number")
    existing = {}
    for i in json.loads(r.stdout or "[]"):
        m = re.match(r"^\[([A-Z]+-\d+)\]", i["title"])
        if m:
            existing[m.group(1)] = i["number"]

    created = 0
    skipped = 0
    failed = []
    for story in stories:
        if story["id"] in existing:
            skipped += 1
            continue

        title = f"[{story['id']}] {story['title']}"
        labels = [
            f"phase-{story['phase']}",
            f"epic:{story['epic'].lower()}",
        ]
        if story["points"]:
            labels.append(f"points:{story['points']}")
        if story["title"].lower().startswith("spike"):
            labels.append("spike")
        if "BAA" in story["title"] or "HIPAA" in story["title"]:
            labels.append("blocked-on-baa")
        if story["id"] == "FND-001":
            labels.append("good-first-task")

        body = (
            f"**Story:** {story['id']}\n"
            f"**Epic:** {story['epic']} — {EPIC_NAMES.get(story['epic'], '?')}\n"
            f"**Phase:** {story['phase']}\n"
            f"**Sprint:** {story['sprint'] or '_unassigned (Phase 2-4 epic-level)_'}\n"
            f"**Story points:** {story['points'] if story['points'] is not None else '—'}\n"
            f"\n"
            f"## Description\n"
            f"\n"
            f"{story['title']}\n"
            f"\n"
            f"## Notes\n"
            f"\n"
            f"{story['notes'] or '_(see BACKLOG.md)_'}\n"
            f"\n"
            f"## Acceptance criteria\n"
            f"\n"
            f"- [ ] _to be defined during sprint planning_\n"
            f"- [ ] passes Definition of Done (see CLAUDE.md)\n"
            f"\n"
            f"---\n"
            f"\n"
            f"_Auto-imported from BACKLOG.md by `scripts/setup-github.py`._\n"
        )

        milestone_title = PHASE_TO_MILESTONE[story["phase"]]
        ms_num = milestone_nums.get(milestone_title)

        print(f"   add   {story['id']:9s}  {story['title'][:65]}")
        if dry_run:
            created += 1
            continue

        args = ["issue", "create", "--repo", repo,
                "--title", title, "--body", body]
        for lbl in labels:
            args += ["--label", lbl]
        if ms_num and ms_num > 0:
            args += ["--milestone", milestone_title]
        r = gh(*args, check=False)
        if r.returncode != 0:
            failed.append(story["id"])
            sys.stderr.write(f"   FAIL  {story['id']}: {r.stderr.strip()}\n")
        else:
            created += 1
        time.sleep(0.4)  # be gentle with API

    print(f"\n   {created} created, {skipped} already existed, {len(failed)} failed")
    if failed:
        sys.stderr.write(f"   failed ids: {', '.join(failed)}\n")


# ------- main -------

def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--repo", help="OWNER/NAME (default: <gh-user>/daviess-coalition-platform)")
    ap.add_argument("--visibility", default="private", choices=["public", "private"])
    ap.add_argument("--dry-run", action="store_true",
                    help="Print what would happen, but still require gh auth")
    ap.add_argument("--preview", action="store_true",
                    help="Parse BACKLOG.md only and print summary — does not call gh")
    ap.add_argument("--skip-repo", action="store_true")
    ap.add_argument("--skip-labels", action="store_true")
    ap.add_argument("--skip-milestones", action="store_true")
    ap.add_argument("--skip-issues", action="store_true")
    args = ap.parse_args()

    if args.preview:
        stories = parse_backlog(BACKLOG_PATH)
        print(f"Parsed {len(stories)} stories from BACKLOG.md\n")
        by_phase = {}
        by_epic = {}
        unsized = []
        for s in stories:
            by_phase.setdefault(s["phase"], {"count": 0, "pts": 0})
            by_phase[s["phase"]]["count"] += 1
            if s["points"]:
                by_phase[s["phase"]]["pts"] += s["points"]
            by_epic.setdefault(s["epic"], {"count": 0, "pts": 0})
            by_epic[s["epic"]]["count"] += 1
            if s["points"]:
                by_epic[s["epic"]]["pts"] += s["points"]
            if s["points"] is None:
                unsized.append(s["id"])
        print("By phase:")
        for p in sorted(by_phase):
            print(f"  Phase {p}: {by_phase[p]['count']:3d} stories, {by_phase[p]['pts']:4d} pts")
        print("\nBy epic:")
        for e in sorted(by_epic):
            print(f"  {e:5s} ({EPIC_NAMES.get(e, '?')[:30]:30s})  {by_epic[e]['count']:3d} stories, {by_epic[e]['pts']:4d} pts")
        total_pts = sum(s["points"] for s in stories if s["points"])
        print(f"\nGRAND TOTAL: {len(stories)} stories, {total_pts} story points")
        if unsized:
            print(f"Unsized (non-coding) stories: {', '.join(unsized)}")
        print("\nFirst 5 stories that would be created:")
        for s in stories[:5]:
            print(f"  [{s['id']}] {s['title'][:60]}")
        print("\nRun without --preview to actually create the issues.")
        return

    gh_check_auth()

    if args.repo:
        owner, name = args.repo.split("/", 1)
    else:
        r = gh("api", "user", "--jq", ".login")
        owner = r.stdout.strip()
        name = "daviess-coalition-platform"
    repo = f"{owner}/{name}"

    print(f"Target: {repo} ({args.visibility})")
    if args.dry_run:
        print("DRY RUN — no changes will be made")

    stories = parse_backlog(BACKLOG_PATH)
    print(f"Parsed {len(stories)} stories from BACKLOG.md")
    by_phase = {}
    by_epic = {}
    for s in stories:
        by_phase[s["phase"]] = by_phase.get(s["phase"], 0) + 1
        by_epic[s["epic"]] = by_epic.get(s["epic"], 0) + 1
    for p in sorted(by_phase):
        print(f"   phase {p}: {by_phase[p]} stories")
    print(f"   epics:   {', '.join(f'{e}={c}' for e, c in sorted(by_epic.items()))}")
    print()

    if not args.skip_repo:
        ensure_repo(owner, name, args.visibility, args.dry_run)
    if not args.skip_labels:
        ensure_labels(repo, args.dry_run)

    milestone_nums = {}
    if not args.skip_milestones:
        milestone_nums = ensure_milestones(repo, args.dry_run)
    else:
        r = gh("api", f"repos/{repo}/milestones?state=all&per_page=100", check=False)
        if r.returncode == 0:
            milestone_nums = {m["title"]: m["number"] for m in json.loads(r.stdout or "[]")}

    if not args.skip_issues:
        ensure_issues(repo, stories, milestone_nums, args.dry_run)

    print()
    print(f"Done. View at: https://github.com/{repo}/issues")
    print()
    print("Next steps:")
    print("  1. Visit github.com → your repo → Projects → New project")
    print("     (Pick the 'Backlog' template; link the repo so issues auto-add)")
    print("  2. Add custom fields: Story Points (number), Sprint (single-select 1-50+),")
    print("     Phase (single-select 0-4), Epic (single-select)")
    print("  3. Push the local scaffolding: cd into the repo dir, git init, commit, push")
    print("  4. Run `claude` and start FND-001")


if __name__ == "__main__":
    main()
