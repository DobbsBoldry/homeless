#!/usr/bin/env python3
"""
Set the Status on a project card by issue number.

Usage:
  python3 scripts/set-card-status.py <issue#> <status>
  python3 scripts/set-card-status.py 24 "In Review"
  python3 scripts/set-card-status.py 24 done

Status is case-insensitive. Accepts: todo | "in progress" | "in review" | done.
Idempotent (no-op if already at target).
"""
import json
import subprocess
import sys

PROJECT_ID = "PVT_kwHOD6tQ0M4BVt1c"
PROJECT_NUM = 1
OWNER = "DobbsBoldry"
STATUS_FIELD_ID = "PVTSSF_lAHOD6tQ0M4BVt1czhRHp-Y"

STATUS_OPTIONS = {
    "todo":         "1a54b4fd",
    "in progress":  "a65cade5",
    "in review":    "71be9c4d",
    "done":         "d74747d3",
}


def gh(args, **kwargs):
    return subprocess.run(["gh", *args], capture_output=True, text=True, check=True, **kwargs)


def gh_graphql(query):
    r = subprocess.run(["gh", "api", "graphql", "-f", f"query={query}"],
                       capture_output=True, text=True)
    if r.returncode != 0:
        sys.exit(f"GraphQL error: {r.stderr}")
    return json.loads(r.stdout)


def find_item_id(issue_num):
    # Avoid `gh project item-list` — it silently caps at 100 items regardless
    # of --limit, so issues past the first page are invisible to it. Query
    # the issue's project memberships directly via GraphQL instead.
    query = (
        'query { repository(owner: "%s", name: "homeless") { '
        'issue(number: %d) { projectItems(first: 10) { nodes { '
        'id project { number } } } } } }'
    ) % (OWNER, issue_num)
    data = gh_graphql(query)
    issue = (data.get("data", {}).get("repository") or {}).get("issue")
    if not issue:
        return None
    for node in issue["projectItems"]["nodes"]:
        if node["project"]["number"] == PROJECT_NUM:
            return node["id"]
    return None


def main():
    if len(sys.argv) != 3:
        sys.exit("usage: set-card-status.py <issue#> <status>")
    issue_num = int(sys.argv[1])
    status_key = sys.argv[2].strip().lower()
    if status_key not in STATUS_OPTIONS:
        sys.exit(f"unknown status: {status_key!r}; pick from {list(STATUS_OPTIONS)}")
    option_id = STATUS_OPTIONS[status_key]

    item_id = find_item_id(issue_num)
    if not item_id:
        sys.exit(f"issue #{issue_num} not on the project board")

    mutation = (
        f'mutation {{ updateProjectV2ItemFieldValue(input: '
        f'{{ projectId: "{PROJECT_ID}", itemId: "{item_id}", '
        f'fieldId: "{STATUS_FIELD_ID}", '
        f'value: {{ singleSelectOptionId: "{option_id}" }} }}) '
        f'{{ projectV2Item {{ id }} }} }}'
    )
    gh_graphql(mutation)
    print(f"#{issue_num} → {status_key}")


if __name__ == "__main__":
    main()
