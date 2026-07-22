#!/usr/bin/env bash
# fetch-feedback.sh — merge PR review + inline + conversation comments into
# one ordered, commit-pinned feed ready for the fix-pr Phase 2 working table.
#
# Usage: fetch-feedback.sh <owner/repo> <pr-number>
#
# Requires: gh (authenticated), jq. If jq is missing, the script aborts with a
# clear message — fix-pr documents the raw `gh` calls as the fallback path.
#
# Output: a TSV-ish working-table skeleton to stdout:
#   #\tsource\tcommit\tpath:line\tclaim\tsubmittedAt\tstatus
# one row per finding, sorted by submittedAt ascending.
#
# ponytail: mechanical only — does not dedup semantically or classify
# (already_done vs stale vs valid). The agent merges duplicates; the script
# only orders and tags. Upgrade path: if classification becomes mechanical,
# keep it in the script; if it stays judgment, keep it here.
#
# ponytail: commit SHA is best-effort. Review bodies sometimes carry a
# short-SHA like "Commit: 1a7a6aa"; otherwise we capture null. The real
# staleness signal is submittedAt ordering, SHA is just a convenience tag.

set -euo pipefail

if [[ $# -ne 2 ]]; then
  echo "usage: $0 <owner/repo> <pr-number>" >&2
  exit 2
fi

REPO="$1"
PR="$2"

if ! command -v gh >/dev/null 2>&1; then
  echo "error: gh not found in PATH (install: https://cli.github.com)" >&2
  exit 3
fi

if ! command -v jq >/dev/null 2>&1; then
  echo "error: jq not found in PATH (fix-pr falls back to raw gh commands)" >&2
  exit 3
fi

# All three calls wrapped so a single auth failure or network error exits cleanly.
PR_JSON="$(gh pr view "$PR" --repo "$REPO" \
  --json number,title,body,headRefName,baseRefName,state,url,files,reviews,comments)" \
  || { echo "error: gh pr view $PR --repo $REPO failed (auth? permissions?)" >&2; exit 4; }

INLINE_JSON="$(gh api "repos/$REPO/pulls/$PR/comments")" \
  || { echo "error: gh api repos/$REPO/pulls/$PR/comments failed" >&2; exit 4; }

CONVO_JSON="$(gh api "repos/$REPO/issues/$PR/comments")" \
  || { echo "error: gh api repos/$REPO/issues/$PR/comments failed" >&2; exit 4; }

# Verify PR was actually found (gh returns {} for unknown PRs rather than failing).
if [[ "$(echo "$PR_JSON" | jq -r '.number // empty')" != "$PR" ]]; then
  echo "error: PR $PR not found in $REPO (or empty response)" >&2
  exit 4
fi

# Header line — matches the Phase 2 working-table format.
printf '#\tsource\tcommit\tpath:line\tclaim\tsubmittedAt\tstatus\n'

# Build the ordered feed. Each finding emits one row.
# Source tags: review / inline / conversation.
jq -r --argjson pr "$PR_JSON" '
  # 1. Reviews: sort by submittedAt, capture short-SHA from body if present.
  ($pr.reviews // [])
    | sort_by(.submittedAt // "")
    | to_entries[]
    | .key as $i
    | .value
    | (.body // "" | capture("Commit:\\s*(?<sha>[0-9a-f]{7,40})"; "i")?.sha // null) as $sha
    | ($i + 1) as $num
    | "review\t\($sha // "")\t\t\(.body // "" | gsub("[\\t\\n\\r]+"; " ") | .[0:200])\t\(.submittedAt // "")\tpending_validation"
' <<<"$PR_JSON" || true

# Inline review comments (file/line threads).
jq -r '
  (. // [])
    | to_entries[]
    | .value
    | "inline\t\(.commit_id // "")\t\(.path // ""):\(.line // .original_line // "")\t\(.body | gsub("[\\t\\n\\r]+"; " ") | .[0:200])\t\(.created_at // "")\tpending_validation"
' <<<"$INLINE_JSON" || true

# Conversation comments (issue-style).
jq -r '
  (. // [])
    | to_entries[]
    | .value
    | "conversation\t\t\t\(.body | gsub("[\\t\\n\\r]+"; " ") | .[0:200])\t\(.created_at // "")\tpending_validation"
' <<<"$CONVO_JSON" || true
