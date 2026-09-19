---
name: thought-dump-writer
description: Use when the user wants to dictate/dump raw thoughts turn-by-turn into a single living markdown document with light editorial cleanup and a git checkpoint after every change — not a multi-file capture tree (see b-capture) and not a multi-persona article workshop.
---

# Thought-Dump Writer

Single-document, turn-by-turn thought capture with light cleanup and a git checkpoint every turn.

## When to use (trigger)

- User says "capture my thoughts", "write down what I say", "thought dump", "take notes as I talk", or pastes raw unstructured thinking and expects it accumulated into one document.
- User names (or is willing to name) a single target markdown file up front.
- Session shape is iterative: user dumps → assistant files it → user dumps more, over many turns.

## When NOT to use

- **b-capture:** user wants a multi-file raw-entry-per-dump tree (one file per dump under a subject folder, no editing/grouping). This skill is one file, one section per topic, corrected for readability.
- If the user asks for summarization, polishing, or restructuring beyond light per-turn correction, that is separate work — ask before doing it.

## Mode contract (state back to the user on turn 1)

On the first turn, state this back briefly so the user knows the rules:

> Single file, one section per topic. Every dump I file it, fix grammar/phrasing only, never add claims. Git checkpoint after every change. Done only when you say so.

## Turn-1 scaffold procedure

1. **Get the target path.** If the user already named one, use it. If not, ask: "Which file should I capture into?" Accept a repo-relative or absolute `.md` path to a single file. Do not accept a directory — the checkpoint script stages exactly one owned file. Do not proceed without it.
2. **Create the file** with just a top-level title heading — nothing else:
   - Title = human-readable form of the filename/topic (e.g. `docs/buck/brainstorm-thoughts.md` → `# Brainstorm Thoughts`).
   - If the file already exists, leave its contents alone — do not rewrite or re-scaffold.
3. **Create the checkpoint script** alongside the target file (same directory, e.g. `docs/buck/checkpoint.sh`) using the template below. `chmod +x` it.
4. **Run the checkpoint script once** with the target path as its first argument: `./checkpoint.sh docs/buck/brainstorm-thoughts.md`. This captures the scaffold commit.

## Checkpoint script (template)

Copy this verbatim — it is a fixed template with **no scaffold-time substitutions** that could be interpreted as shell. The target file path is passed in as `$1` (argv) every run, so user input never lands in the script source. The script:

- accepts exactly one argv: the repo-relative path to a single owned file;
- adds and commits only that path;
- is an idempotent no-op when there is nothing new;
- never touches unrelated dirty files;
- appends an `Issue:` trailer only when the current branch name is a bare integer (project convention where branches are issue numbers and a gate enforces the trailer). It never fails just because no trailer applies.

```bash
#!/usr/bin/env bash
set -euo pipefail
# Checkpoint the thought-dump target file.
# Usage: ./checkpoint.sh <repo-relative-target-file>
# The target path is passed as argv, never interpolated into this script.

if [[ $# -ne 1 ]]; then
  echo "usage: $0 <repo-relative-target-file>" >&2
  exit 64
fi

TARGET="$1"

# Reject anything that isn't a plain repo-relative path to a regular file.
# - no leading '-' (could be confused with a git option)
# - no '..' segments (must not escape the owned path)
# - must be a single relative path (no directories)
case "$TARGET" in
  -*|"" )
    echo "checkpoint: refusing unsafe target '$TARGET'" >&2
    exit 64
    ;;
  */* )
    LEAD="${TARGET%%/*}"
    if [[ "$LEAD" == ".." || "$LEAD" == "." || -z "$LEAD" ]]; then
      echo "checkpoint: refusing path with '$LEAD' segment: '$TARGET'" >&2
      exit 64
    fi
    ;;
esac

ROOT="$(git rev-parse --show-toplevel)"
cd "$ROOT"

# Target must exist and be a regular file before staging.
if [[ ! -f "$TARGET" ]]; then
  echo "checkpoint: target '$TARGET' is not a regular file" >&2
  exit 1
fi

MSG="docs: checkpoint ${TARGET##*/}"

# Stage ONLY the owned file — never anything else in the working tree.
git add -- "$TARGET"

# Idempotent no-op: nothing staged, nothing to do.
if git diff --cached --quiet; then
  echo "no changes to checkpoint"
  exit 0
fi

# Commit message body (read from argv-derived file path) is constructed via
# printf %q-style quoting: never re-evaluate $TARGET inside double quotes
# without quoting it, and never splice it into a `git commit -m` argument list
# other than via the staged path. The commit message is hard-coded — the path
# is never embedded in the message string.
BRANCH="$(git rev-parse --abbrev-ref HEAD 2>/dev/null || true)"
if [[ "$BRANCH" =~ ^[0-9]+$ ]]; then
  git commit -m "$MSG" -m "Issue: #$BRANCH"
else
  git commit -m "$MSG"
fi
```

Target-path notes:

- Pass the path as the first argument every run. Never edit the script to embed a literal path — the template is intentionally path-free so the same script can be re-used across sessions, and so user input never enters the script source.
- Commit message: short conventional-commit-style, scoped to the file area (e.g. `docs: checkpoint brainstorm-thoughts.md`). The path itself is **not** interpolated into the commit subject — only the filename tail is, via parameter expansion that strips directories. Keep it stable across turns.

## Per-dump procedure (every turn, no batching)

In the SAME turn the user dumps, do all four steps in order:

1. **Edit the file.** Add the dump as a new `## Heading` section, or as a bullet appended to an existing section if it belongs there.
2. **Light correction only.** Fix grammar/spelling/phrasing, tighten wording. MUST NOT change meaning, MUST NOT elaborate, invent, or add claims/facts not present in what the user said.
3. **Group when it belongs together.** If related dumps emerge across turns, reorganize retroactively: move a bullet under a shared heading, split a paragraph into a sub-list. Always preserve each original point's substance.
4. **Run the checkpoint script immediately.** Every turn, no batching, no "I'll commit later."

Optional within a turn: ask a clarifying question, or dispatch a read-only scout subagent to verify a factual claim the user made. Uncertain/unverified content stays flagged or asked about — never silently "fixed."

## Do / Don't (light correction vs fabrication)

User dump: "the cache invalidation is broke when we deploy friday it race conditions the stale reads"

- DO (light correction, same meaning): `## Deploys` / `- Cache invalidation races on Friday deploys, causing stale reads.`
- DON'T (fabrication): `- Cache invalidation races on Friday deploys because the Redis TTL (300s) expires before the CDN purges; switch to write-through caching.` — the TTL, CDN, and fix were never said. Never invent causes, numbers, or recommendations.

Rule: if the corrected sentence contains a noun, number, or claim the user's words did not contain, delete it or flag it as `[unverified]` and ask.

## Reply style

Terse, outcome-first, no process narration. Report only what changed in 1–2 lines: which section, what was added/moved. Example: `Filed under ## Deploys, checkpointed.` Not a transcript of the edit.

## Completion

The session ends only when the user explicitly says the document is done. No auto-summarization, no auto-polish, no "final cleanup pass" beyond the light per-turn correction above.
