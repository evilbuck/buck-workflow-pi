---
name: b-capture
description: Live note-taking mode — the user dumps thoughts (often dictated, messy) and a subagent writes durable rough notes the same turn (or into a single checkpointed document via --single-file <path>). Do not tidy or synthesize until the user says so.
---

# b-capture: Note-taking mode

How we take notes. The user dumps. You scribe. Durable notes are written *this turn*. Polish is later, and only when they say so.

Topic-agnostic. Not tied to any domain — skills, code, research, or otherwise.

This is not `/b-research` (agent investigates and synthesizes) and not `/b-explore` (agent traces the codebase).

## Two Capture Modes

1. **Multi-file capture tree (default)**: One immutable file per dump (`notes/entries/<NNN>.md`) written by a subagent under `.context/YYYY-MM-DD.<subject>/` (or a named notes root), with an append-only `notes/raw-capture-log.md` spine.
2. **Single-file checkpoint mode (`--single-file <path>`)**: Turn-by-turn thought capture into a single living Markdown document (`<path>`) with one section per topic, light grammar/phrasing cleanup (never adding claims), and an immediate git checkpoint after every turn.

## When to use

- "write the notes as we go"
- "use a subagent, don't wait until the end"
- "I'll dictate / word vomit" / "thought dump"
- "we'll tidy later — I'll tell you when"
- User names a single `.md` target file or passes `--single-file <path>` for a living checkpointed document

## When not to use

- Agent should go look things up → `/b-research` or `/b-explore`
- User wants a plan → `/b-plan`
- User asked to tidy or synthesize *now* → leave this mode; do that work

## Mode contract (state this back on turn 1)

### Default multi-file mode contract

1. **Per-turn, never batched.** Every dump is written down on the turn it arrives.
2. **Subagent writes.** Mainline stays free for the next dump.
3. **Messy is correct.** Record contradictions; do not resolve them. Strike through wrong turns (`~~…~~` + reason); never delete.
4. **Repair dictation by context.** Speech-to-text garble is fixed silently when intent is clear. Two plausible readings → record both, flag it. Never silently pick.
5. **Polish is deferred.** No tidy-up, no summary-of-summaries, until the user explicitly says so. `/b-save` does not count.

### `--single-file <path>` mode contract

On the first turn in `--single-file` mode, state back briefly:
> Single file (`<path>`), one section per topic. Every dump I file it, fix grammar/phrasing only, never add claims. Git checkpoint after every change. Done only when you say so.

## Write boundary

Default: `.context/YYYY-MM-DD.<subject>/` only.
If the user named a path (or passed `--single-file <path>`), that path is the notes target.
Do not modify application code.

Durable Buck artifacts are addressed through `workflow_state` or `bun skills/_shared/scripts/workflow-state-cli.ts`, per `skills/_shared/workflow-state-access.md`. The logical names below are the artifact identity. A `.context/` path is only the repo-files projection, not a required input. Do not construct SQL or call `sql_memory`.

## Turn 1 — scaffold before any dump lands (Default multi-file mode)

Resolve subject via `skills/_shared/subject-resolution.md`. If none, infer from `$ARGUMENTS` or the first dump, create the folder, and run `bun skills/_shared/scripts/subject-lifecycle.ts initialize --subject <folder> --json`.

Create:

```
<notes-root>/
  index.md                 # lifecycle authority projection; what this is; file map
  notes/raw-capture-log.md # the spine — append-only pointers, newest at bottom
  notes/entries/           # one immutable file per dump; never rewritten
  glossary.md
  open-questions.md
```

Seed the log with a tag legend. End the log with:

```markdown
<!-- New entries append below this line. -->
```

Keep that comment the last line forever.

### Claim tags (every factual claim gets one)

| Tag | Meaning |
| --- | --- |
| `[verified]` | Opened the named file this session |
| `[unverified]` | User-reported, not yet checked |
| `[inference]` | Reasoned, not observed |
| `[conflict]` | Two sources disagree; both recorded |
| `[question]` | Open — also row in `open-questions.md` |

State the five-point contract in a few lines. Invite the first dump.

If `$ARGUMENTS` is already a dump (multiple sentences), scaffold then write `notes/entries/001.md` and a log pointer as Entry 1 in the same turn.

## Every later turn — dispatch, don't transcribe yourself (Default multi-file mode)

1. Repair obvious garble.
2. Allocate the next unused `notes/entries/<NNN>.md` (zero-pad, never reuse a path an in-flight agent owns). Spawn **one** subagent for this dump. Brief: verbatim dump, entry number, that exclusive target file, tag legend, "write this file only — never rewrite it, never touch any other file", "do not synthesize". Acceptance = that file exists with one tagged entry.
3. Do not idle. Cheap `[verified]` checks on the main thread are fine.
4. Mainline owns shared files. Append one pointer above the log marker (`- Entry N → notes/entries/NNN.md`). Do not wait for the subagent. Never let a subagent write the log, glossary, open-questions, or index. Glossary / open-questions / index updates wait until no other dump is in flight, or happen on a later turn.
5. Split a subject into `notes/<subject>.md` only when it has earned the page. Leave a pointer in the log. Update the index map.
6. Operator testimony is ground truth for symptoms. Verify *why*, don't re-measure what the user reported.

## Single-File Mode (`--single-file <path>`)

When the user passes `--single-file <path>` (or explicitly asks to accumulate thought dumps into one living Markdown document with per-turn git checkpoints):

### Turn-1 scaffold (`--single-file`)
1. **Resolve the target path.** Require a single `.md` file path (not a directory). If missing, ask: "Which file should I capture into?"
2. **Create the file** if it does not exist, with only a top-level `# <Title>` heading. If it already exists, leave its contents untouched.
3. **Create `checkpoint.sh`** alongside the target file (`chmod +x`) by copying the template below verbatim. The target path is `$1` on every run. Never interpolate the path into the script source.
4. **Run `./checkpoint.sh <target-path>`** once to capture the scaffold commit.

### Checkpoint script (template)

Copy this verbatim. It accepts one repo-relative file, stages and commits only that path (other staged files stay staged), and exits 0 when that file has no staged change. It appends an `Issue:` trailer only when the current branch name is a bare integer.

```bash
#!/usr/bin/env bash
set -euo pipefail
# Usage: ./checkpoint.sh <repo-relative-target-file>

if [[ $# -ne 1 ]]; then
  echo "usage: $0 <repo-relative-target-file>" >&2
  exit 64
fi

TARGET="$1"

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

if [[ ! -f "$TARGET" ]]; then
  echo "checkpoint: target '$TARGET' is not a regular file" >&2
  exit 1
fi

MSG="docs: checkpoint ${TARGET##*/}"
git add -- "$TARGET"
if git diff --cached --quiet -- "$TARGET"; then
  echo "no changes to checkpoint"
  exit 0
fi

BRANCH="$(git rev-parse --abbrev-ref HEAD 2>/dev/null || true)"
if [[ "$BRANCH" =~ ^[0-9]+$ ]]; then
  git commit -m "$MSG" -m "Issue: #$BRANCH" -- "$TARGET"
else
  git commit -m "$MSG" -- "$TARGET"
fi
```

### Per-dump procedure (`--single-file`, every turn, no batching)
1. **Edit the file.** Add the dump as a new `## Heading` section or append a bullet under an existing section.
2. **Light correction only.** Fix grammar/spelling/phrasing only. Never change meaning, elaborate, or invent causes/numbers/claims not in the user's words (if uncertain, flag `[unverified]` and ask).
3. **Group related points** across turns under shared headings while preserving every original point's substance.
4. **Run `./checkpoint.sh <target-path>` immediately** on the same turn. Reply in 1–2 lines (`Filed under ## <Section>, checkpointed.`).

## Reply

Lead with what landed. Surface only contradictions and unverified claims. Do not summarize the notes — the user is mid-flow. Invite the next dump.

## Leaving note-taking mode

Only when the user says tidy / refine / synthesize / "start consolidating" / "done". Then stop capturing and do that work from the notes tree (or leave the single file finalized). Until then, stay in this mode even if the notes look messy enough to polish.
