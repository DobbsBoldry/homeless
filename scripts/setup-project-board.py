#!/usr/bin/env python3
"""
setup-project-board.py — configure the GitHub Project (v2) board.

Idempotent. Re-run safely.

What it does:
1. Reconfigures the Sprint single-select field with options "Sprint 1" .. "Sprint 12".
2. Adds "In Review" to Status (preserves existing Todo / In Progress / Done).
3. Creates Phase (0-4) and Epic (FND, EVDT, ...) single-select fields if missing.
4. Backfills every project item with: Story Points (from points:N label),
   Phase (from phase-N label), Epic (from epic:xxx label).
5. Assigns FND-001 .. FND-009 to Sprint 1.

Requires: gh CLI authed with `project,read:project,repo` scopes.
"""

from __future__ import annotations

import json
import re
import subprocess
import sys
from dataclasses import dataclass

OWNER = "DobbsBoldry"
REPO = "homeless"
PROJECT_ID = "PVT_kwHOD6tQ0M4BVt1c"
PROJECT_NUM = 1

EPICS = [
    "FND", "EVDT", "ESUC", "CWT", "INDC", "COOR", "OPRT",
    "DTRS", "SUPP", "SUBP", "PRVN", "PCYI", "REPL", "FULL",
]
SPRINT_COUNT = 12
SPRINT_1_STORIES = [f"FND-00{i}" for i in range(1, 10)]


def gh_graphql(query: str) -> dict:
    result = subprocess.run(
        ["gh", "api", "graphql", "-f", f"query={query}"],
        capture_output=True, text=True,
    )
    if result.returncode != 0:
        sys.exit(f"GraphQL error: {result.stderr}\n{result.stdout}")
    data = json.loads(result.stdout)
    if "errors" in data:
        sys.exit(f"GraphQL errors: {json.dumps(data['errors'], indent=2)}")
    return data["data"]


def get_project_fields() -> dict[str, dict]:
    q = f'''query {{
        node(id: "{PROJECT_ID}") {{
            ... on ProjectV2 {{
                fields(first: 50) {{
                    nodes {{
                        ... on ProjectV2FieldCommon {{ id name dataType }}
                        ... on ProjectV2SingleSelectField {{
                            id name dataType
                            options {{ id name }}
                        }}
                    }}
                }}
            }}
        }}
    }}'''
    data = gh_graphql(q)
    fields = {}
    for f in data["node"]["fields"]["nodes"]:
        if f:
            fields[f["name"]] = f
    return fields


def update_single_select_options(field_id: str, options: list[tuple[str, str]]):
    """options = [(name, color), ...]; color = GREEN/BLUE/PURPLE/etc."""
    opts_str = ", ".join(
        f'{{name: "{n}", color: {c}, description: ""}}' for n, c in options
    )
    q = f'''mutation {{
        updateProjectV2Field(input: {{
            fieldId: "{field_id}"
            singleSelectOptions: [{opts_str}]
        }}) {{
            projectV2Field {{ ... on ProjectV2SingleSelectField {{ name options {{ id name }} }} }}
        }}
    }}'''
    return gh_graphql(q)


def create_single_select_field(name: str, options: list[tuple[str, str]]) -> dict:
    opts_str = ", ".join(
        f'{{name: "{n}", color: {c}, description: ""}}' for n, c in options
    )
    q = f'''mutation {{
        createProjectV2Field(input: {{
            projectId: "{PROJECT_ID}"
            dataType: SINGLE_SELECT
            name: "{name}"
            singleSelectOptions: [{opts_str}]
        }}) {{
            projectV2Field {{
                ... on ProjectV2SingleSelectField {{ id name options {{ id name }} }}
            }}
        }}
    }}'''
    return gh_graphql(q)


def get_all_issues_with_labels() -> dict[int, list[str]]:
    """Map issue number -> list of label names."""
    result = subprocess.run(
        ["gh", "issue", "list", "--repo", f"{OWNER}/{REPO}",
         "--state", "all", "--limit", "300",
         "--json", "number,labels"],
        capture_output=True, text=True, check=True,
    )
    issues = json.loads(result.stdout)
    return {i["number"]: [l["name"] for l in i["labels"]] for i in issues}


def get_project_items() -> list[dict]:
    """All project items: id + linked issue number + title."""
    result = subprocess.run(
        ["gh", "project", "item-list", str(PROJECT_NUM),
         "--owner", OWNER, "--limit", "300", "--format", "json"],
        capture_output=True, text=True, check=True,
    )
    data = json.loads(result.stdout)
    items = []
    for it in data["items"]:
        c = it.get("content") or {}
        items.append({
            "item_id": it["id"],
            "issue_num": c.get("number"),
            "title": c.get("title", ""),
        })
    return items


def set_number_field(item_id: str, field_id: str, value: float):
    q = f'''mutation {{
        updateProjectV2ItemFieldValue(input: {{
            projectId: "{PROJECT_ID}"
            itemId: "{item_id}"
            fieldId: "{field_id}"
            value: {{ number: {value} }}
        }}) {{ projectV2Item {{ id }} }}
    }}'''
    gh_graphql(q)


def set_single_select_field(item_id: str, field_id: str, option_id: str):
    q = f'''mutation {{
        updateProjectV2ItemFieldValue(input: {{
            projectId: "{PROJECT_ID}"
            itemId: "{item_id}"
            fieldId: "{field_id}"
            value: {{ singleSelectOptionId: "{option_id}" }}
        }}) {{ projectV2Item {{ id }} }}
    }}'''
    gh_graphql(q)


def parse_story_id(title: str) -> str | None:
    m = re.match(r"\[(\w+-\d+)\]", title)
    return m.group(1) if m else None


SPRINT_COLORS = ["BLUE", "GREEN", "PURPLE", "PINK", "ORANGE", "YELLOW",
                 "RED", "GRAY", "BLUE", "GREEN", "PURPLE", "PINK"]
PHASE_COLORS = ["GRAY", "BLUE", "GREEN", "PURPLE", "ORANGE"]
EPIC_COLORS = ["BLUE", "GREEN", "PURPLE", "PINK", "ORANGE", "YELLOW",
               "RED", "GRAY", "BLUE", "GREEN", "PURPLE", "PINK", "ORANGE", "YELLOW"]


def main():
    print("Step 1: fetching current project fields…")
    fields = get_project_fields()

    # --- Sprint field ---
    print("Step 2: reconfiguring Sprint field with Sprint 1-12 options…")
    sprint_opts = [(f"Sprint {i}", SPRINT_COLORS[(i - 1) % len(SPRINT_COLORS)])
                   for i in range(1, SPRINT_COUNT + 1)]
    update_single_select_options(fields["Sprint"]["id"], sprint_opts)

    # --- Status field: add In Review (preserve existing) ---
    print("Step 3: adding 'In Review' to Status (preserving existing)…")
    existing_status = [(o["name"], "GRAY") for o in fields["Status"]["options"]]
    if "In Review" not in [n for n, _ in existing_status]:
        # Order: Todo, In Progress, In Review, Done
        order = ["Todo", "In Progress", "In Review", "Done"]
        colors = {"Todo": "GRAY", "In Progress": "YELLOW",
                  "In Review": "ORANGE", "Done": "GREEN"}
        new_status = [(n, colors[n]) for n in order]
        update_single_select_options(fields["Status"]["id"], new_status)

    # --- Phase field ---
    if "Phase" not in fields:
        print("Step 4a: creating Phase field…")
        phase_opts = [(str(i), PHASE_COLORS[i]) for i in range(5)]
        create_single_select_field("Phase", phase_opts)
    else:
        print("Step 4a: Phase field already exists; skipping.")

    # --- Epic field ---
    if "Epic" not in fields:
        print("Step 4b: creating Epic field…")
        epic_opts = [(e, EPIC_COLORS[i]) for i, e in enumerate(EPICS)]
        create_single_select_field("Epic", epic_opts)
    else:
        print("Step 4b: Epic field already exists; skipping.")

    # Re-fetch fields to pick up new IDs/option IDs
    print("Step 5: re-fetching field IDs…")
    fields = get_project_fields()
    sprint_field = fields["Sprint"]
    points_field = fields["Story Points"]
    phase_field = fields["Phase"]
    epic_field = fields["Epic"]

    sprint_opts_by_name = {o["name"]: o["id"] for o in sprint_field["options"]}
    phase_opts_by_name = {o["name"]: o["id"] for o in phase_field["options"]}
    epic_opts_by_name = {o["name"]: o["id"] for o in epic_field["options"]}

    # --- Backfill ---
    print("Step 6: fetching all issue labels…")
    labels_by_issue = get_all_issues_with_labels()

    print("Step 7: fetching all project items…")
    items = get_project_items()
    print(f"   {len(items)} items.")

    print("Step 8: backfilling fields on each item (this takes ~5 min)…")
    backfilled = 0
    for idx, item in enumerate(items, 1):
        issue_num = item["issue_num"]
        if not issue_num or issue_num not in labels_by_issue:
            continue
        labels = labels_by_issue[issue_num]
        story_id = parse_story_id(item["title"])

        # Story Points
        for lbl in labels:
            m = re.match(r"points:(\d+)", lbl)
            if m:
                set_number_field(item["item_id"], points_field["id"], float(m.group(1)))
                break

        # Phase
        for lbl in labels:
            m = re.match(r"phase-(\d+)", lbl)
            if m and m.group(1) in phase_opts_by_name:
                set_single_select_field(item["item_id"], phase_field["id"],
                                        phase_opts_by_name[m.group(1)])
                break

        # Epic
        for lbl in labels:
            m = re.match(r"epic:(\w+)", lbl)
            if m:
                epic_name = m.group(1).upper()
                if epic_name in epic_opts_by_name:
                    set_single_select_field(item["item_id"], epic_field["id"],
                                            epic_opts_by_name[epic_name])
                    break

        # Sprint 1 assignment
        if story_id in SPRINT_1_STORIES:
            set_single_select_field(item["item_id"], sprint_field["id"],
                                    sprint_opts_by_name["Sprint 1"])

        backfilled += 1
        if idx % 25 == 0:
            print(f"   {idx}/{len(items)}…")

    print(f"\nDone. Backfilled {backfilled} items.")
    print(f"View: https://github.com/users/{OWNER}/projects/{PROJECT_NUM}")


if __name__ == "__main__":
    main()
