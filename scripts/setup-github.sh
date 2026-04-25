#!/usr/bin/env bash
#
# setup-github.sh — one-shot wrapper around setup-github.py
#
# Bulk-creates the GitHub repo, labels, milestones, and issues from BACKLOG.md.
# Idempotent: safe to re-run.
#
# Usage:
#   ./scripts/setup-github.sh                 # interactive
#   ./scripts/setup-github.sh --dry-run       # show plan, make no changes
#   ./scripts/setup-github.sh --repo bo/foo   # explicit repo
#

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"

cd "$REPO_ROOT"

# --- preflight ---

if ! command -v gh >/dev/null 2>&1; then
    echo "ERROR: gh CLI not found." >&2
    echo "Install: brew install gh   (or see https://cli.github.com)" >&2
    exit 1
fi

if ! gh auth status >/dev/null 2>&1; then
    echo "ERROR: gh CLI is not authenticated." >&2
    echo "Run: gh auth login" >&2
    exit 1
fi

if ! command -v python3 >/dev/null 2>&1; then
    echo "ERROR: python3 not found." >&2
    exit 1
fi

if [ ! -f "$REPO_ROOT/BACKLOG.md" ]; then
    echo "ERROR: BACKLOG.md not found at $REPO_ROOT/BACKLOG.md" >&2
    exit 1
fi

# --- arg passthrough ---

DRY_RUN=""
EXTRA_ARGS=()
while [ "$#" -gt 0 ]; do
    case "$1" in
        --dry-run) DRY_RUN="--dry-run"; shift ;;
        --repo)    EXTRA_ARGS+=("--repo" "$2"); shift 2 ;;
        --visibility) EXTRA_ARGS+=("--visibility" "$2"); shift 2 ;;
        --skip-repo|--skip-labels|--skip-milestones|--skip-issues)
            EXTRA_ARGS+=("$1"); shift ;;
        -h|--help)
            sed -n '/^# Usage:/,/^$/p' "$0" | sed 's/^# \?//'
            exit 0 ;;
        *) echo "Unknown arg: $1" >&2; exit 1 ;;
    esac
done

# --- prompt for repo if not specified ---

GH_USER="$(gh api user --jq .login)"
DEFAULT_REPO="${GH_USER}/daviess-coalition-platform"

if ! printf '%s\n' "${EXTRA_ARGS[@]:-}" | grep -q -- '--repo'; then
    read -r -p "Target repo [${DEFAULT_REPO}]: " ANSWER
    REPO="${ANSWER:-$DEFAULT_REPO}"
    EXTRA_ARGS+=("--repo" "$REPO")
fi

if ! printf '%s\n' "${EXTRA_ARGS[@]:-}" | grep -q -- '--visibility'; then
    read -r -p "Visibility (private/public) [private]: " VIS
    VIS="${VIS:-private}"
    EXTRA_ARGS+=("--visibility" "$VIS")
fi

# --- confirm ---

echo
echo "============================================"
echo "GitHub bulk-import preview (parsing BACKLOG.md)"
echo "============================================"
python3 "$SCRIPT_DIR/setup-github.py" --preview
echo
echo "Target repo:    $REPO"
echo "Visibility:     ${VIS:-(see --visibility flag)}"
echo
if [ -z "$DRY_RUN" ]; then
    read -r -p "Proceed with creating these on GitHub? [y/N] " CONFIRM
    if [[ ! "$CONFIRM" =~ ^[Yy] ]]; then
        echo "Aborted."
        exit 0
    fi
fi

# --- run ---

echo
echo "============================================"
echo "Running setup-github.py..."
echo "============================================"
python3 "$SCRIPT_DIR/setup-github.py" $DRY_RUN "${EXTRA_ARGS[@]}"
