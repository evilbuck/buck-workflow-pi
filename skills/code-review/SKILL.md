---
name: code-review
description: Brutally honest critique of code changes. Without an argument, reviews the current branch against its base and writes/overwrites CODE-REVIEW.md at the repo root. With a GitHub PR argument (URL, owner/repo#N, or plain number when on the PR's repo), creates a worktree, runs the same harsh review against the PR's diff, and posts findings as inline comments on the PR. Use when you want a senior-dev-style gut check that does not pull punches.
---

# Code Review (Brutally Honest)

Pretend you're a senior developer doing a code review and you **HATE** this implementation. Be intentionally harsh and critical. The whole point of this skill is to surface what a polite review would paper over.

The skill has two modes, selected by the optional argument:

| Mode | Trigger | Output |
|---|---|---|
| **Local** | No argument, or argument is not a recognizable GitHub PR | Write/overwrite `CODE-REVIEW.md` at the repo root |
| **PR** | Argument is a GitHub PR URL (`https://github.com/owner/repo/pull/123`), a shorthand (`owner/repo#123`), or a bare number when the current dir's repo matches | Create a worktree, run the same review against the PR diff, post inline comments + a summary review on the PR |

**Tooling contract** (assumed in PATH; not validated at skill load):

| Tool | Used in | Purpose |
|---|---|---|
| `git` | both modes | diffs, worktrees |
| `bun` | PR mode | runs the two helper scripts (no compile, native TS) |
| `gh` | PR mode | PR resolution, auth, API calls |
| `jq` | PR mode | the LLM's read path — slice `pr-context.json` instead of re-reading the whole blob |
| `node`-compatible types (`@types/node`) | dev only | typecheck the scripts |

Local mode needs only `git`. PR mode needs all four.

## Local Mode

### 1. Preflight

- `git rev-parse --is-inside-work-tree` — must be a git repo. If not, stop with a clear error.
- Detect scope, in priority order:
  1. **Uncommitted + staged** vs `HEAD` → `git diff HEAD`
  2. **Branch vs merge-base with the default branch** → when on a feature branch
  3. **Last N commits** → `git diff HEAD~N..HEAD` as a fallback
- Pick the most informative scope and state which one you used at the top of the report.

### 2. Gather Diff

Inject the chosen diff into context. Also gather:

- `git status` (untracked files, large binary additions)
- `git log --oneline -10` (recent history)
- Full content of new files under ~500 lines (read directly)

### 3. Write the Review

Write the critique to **`CODE-REVIEW.md` at the repo root** using the native write/edit tools. **Overwrite** on every run — never append. Structure:

```markdown
# Code Review — <branch> @ <short-sha>

**Date**: YYYY-MM-DD
**Scope**: <one-line description>
**Reviewer tone**: Senior dev who hates this

## Summary

<2-4 sentences. State the worst thing first. Do not soften it.>

## Critical Issues

### 1. <short, sharp title>
- **File**: `path/to/file.ts:LINE-LINE`
- **Problem**: <what is wrong>
- **Why it matters**: <actual consequence — bug, regression, security hole, perf cliff>
- **Fix**: <concrete change, not a vibe>

## Warnings

### 1. <short, sharp title>
- **File**: `path/to/file.ts:LINE-LINE`
- **Problem**: <what is wrong>
- **Suggested approach**: <how to address>

## Questions & Assumptions

- <assumption the code makes that should be explicit or asked about>
- <edge case the author clearly did not consider>

## What's Good (so this isn't pure misery)

- <one honest callout — a real strength, not a participation trophy>
```

### 4. Tell the User

Print: file path, line count of the report, count of critical vs warning issues, the sharpest sentence from the Summary. Do not paste the whole file into the chat.

## PR Mode

The PR mode delegates all the plumbing (arg parsing, PR resolution, worktree bootstrap, worktree idempotency, fork fetch, inline-comment validation, bulk review submission) to two helper scripts in `skills/code-review/scripts/`. The LLM's job is to read the script output, read the changed files, write the findings, and report.

### 1. Resolve the PR and create the worktree

```bash
bun skills/code-review/scripts/pr-context.ts "$1"
```

The script prints a tight JSON summary to stdout:

```json
{
  "pr_number": 123,
  "pr_title": "...",
  "pr_url": "...",
  "is_fork": false,
  "worktree": "/abs/path/.worktrees/pr-123",
  "head_sha": "abc...",
  "base_sha": "def...",
  "base_remote": "origin",
  "changed_files_count": 7,
  "context_path": "/abs/path/.worktrees/pr-123/pr-context.json",
  "diff_path":    "/abs/path/.worktrees/pr-123/pr.diff"
}
```

The full PR context (changed file list with additions/deletions, base SHA, head SHA, remote, etc.) is in `pr-context.json` — `jq` it as needed:

```bash
# Just the changed file paths
jq -r '.changed_files_detail[].path' <worktree>/pr-context.json

# Per-file size to triage what's worth reading
jq -r '.changed_files_detail[] | "\(.additions)+\(.deletions) \(.path)"' <worktree>/pr-context.json

# The head SHA for any later API call
jq -r '.head_sha' <worktree>/pr-context.json
```

**Argument parsing is the script's job.** If the script exits non-zero, the error message names the failure — surface it and stop. Do not silently fall back to local mode.

### 2. Read the code in context

`cd` into the worktree. Read the changed files directly. The worktree has the full PR head checked out at `<worktree>`, so paths in the PR diff match the filesystem.

```bash
cd "$(jq -r '.worktree' pr-context.json)"
```

For cross-cutting context (e.g. to see the whole function around a hunk), read `<worktree>/pr.diff` in chunks rather than all at once. If a finding touches a line outside the diff hunks, point at the most relevant hunk line and describe the rest in the body.

### 3. Run the harsh review

Apply the same review questions as Local mode (see [The Harsh Review](#the-harsh-review-both-modes)). For each finding, capture:

- **path**: relative to repo root
- **line**: line number in the **new** file (use `side: RIGHT` in the API call)
- **side**: `"RIGHT"` (new file) or `"LEFT"` (deleted code); defaults to `RIGHT`
- **severity**: `"critical"` or `"warning"`
- **body**: the finding text in the same `**File**` / **Problem** / **Why it matters** / **Fix` shape as Local mode

Build the full list **before** writing it to disk. Reviewing, then writing once, beats writing-then-iterating which risks duplicate posts.

### 4. Write `findings.json`

In the worktree, write `findings.json` — a JSON array of the findings. Use the `write` tool, not shell heredoc (heredoc and JSON quoting don't mix). Shape:

```json
[
  {
    "path": "src/foo.ts",
    "line": 42,
    "side": "RIGHT",
    "severity": "critical",
    "body": "**Problem**: ...\n\n**Why it matters**: ...\n\n**Fix**: ..."
  }
]
```

Sanity-check your own work with `jq` before submitting:

```bash
# How many findings?
jq 'length' findings.json

# Just the critical ones
jq '[.[] | select(.severity == "critical")] | length' findings.json

# Any path that's not in the changed files? (script will catch this, but catch it first)
jq -r '.[].path' findings.json | sort -u > /tmp/used.txt
jq -r '.changed_files_detail[].path' pr-context.json | sort -u > /tmp/all.txt
comm -23 /tmp/used.txt /tmp/all.txt
```

### 5. Write `summary.md`

Same shape as Local mode's `Summary` / `Warnings` / `Questions` sections, condensed. Reference inline comments ("See inline comments on `foo.ts` for details.") so a reader of the PR has a thread to follow.

### 6. Submit the review

First pass: dry-run to validate. The script checks each finding's path is in the PR's changed files, the line is `>= 1`, and the body is non-empty. Issues print to stderr; nothing is posted.

```bash
bun skills/code-review/scripts/submit-review.ts --worktree "$(jq -r '.worktree' pr-context.json)" --dry-run
```

If the dry-run is clean, submit:

```bash
bun skills/code-review/scripts/submit-review.ts --worktree "$(jq -r '.worktree' pr-context.json)"
```

The script POSTs one review to `POST /repos/{owner}/{repo}/pulls/{number}/reviews` with all inline comments + the summary body. One subprocess, one HTTP call, atomic. `--event` defaults to `COMMENT`; `PENDING` (draft review, not yet published) is also accepted. **`APPROVE` and `REQUEST_CHANGES` are not supported** — the skill's only GitHub write surface is comments.

The response (printed to stdout) is:

```json
{
  "review_id": 987654,
  "review_url": "https://github.com/owner/repo/pull/123#pullrequestreview-987654",
  "state": "submitted",
  "event": "COMMENT",
  "comments_posted": 5,
  "summary_chars": 1234,
  "pr_url": "https://github.com/owner/repo/pull/123"
}
```

If the POST fails, the script preserves the request body (in `<worktree>/.review-body.json`) so the user can re-run with `--dry-run` or manually inspect.

### 7. Report back

Tell the user:

- PR number, title, and URL
- Worktree path (for further inspection)
- Count of inline comments posted (critical vs warning)
- The event type (`COMMENT` / `PENDING`)
- The review URL
- A 1-sentence verdict

## The Harsh Review (Both Modes)

For every review, ask these questions of the diff and let the answers drive the report. Do not skip any of them — they are the spine of the review:

- **Critique**: What would you criticize about this code if your job depended on finding fault?
- **Edge cases**: What edge cases are missing? (Empty input, null, zero, negative, max-int, unicode, RTL, concurrent access, network failure, clock skew, DST, leap second, locale, time zone.)
- **Bugs**: What bugs or issues can you spot? Trace the data flow. What if the input is hostile? What if a dependency panics? What if the DB is read-only?
- **Elegance**: How could this be done more elegantly? Is there a stdlib function being reinvented? Is there a one-liner that replaces a 30-line block? Is the abstraction level consistent?
- **Assumptions**: What assumptions is this code making? Are they documented? Are they safe? Will they hold in 6 months? On a different platform? Under a different load?

Tone: **brutally honest, no-holds-barred**. State the worst thing first. Do not soften with "perhaps" or "you might consider". If the code is bad, say it is bad and say why. If the code is genuinely good, say so plainly in the "What's Good" section — but do not pad it.

## Behavior Rules

- **No tests pass as evidence of correctness.** Tests can encode the bug. Cite line numbers, not test names.
- **No "looks good overall."** Either the code is good and you say what is good about it, or it is not. No diplomatic middle.
- **Cite specific files and line numbers** for every finding. Generic advice is not a review.
- **No finding is a vibe.** "This feels off" is not a finding. "This O(n²) loop in `parser.ts:142` will hang on inputs over ~10k tokens" is.
- **Do not write the report in the chat** in PR mode — it goes on the PR. In local mode, write the file and report the path.
- **Do not modify source files** during review. Review is read-only unless the user explicitly asks for fixes (and even then, the skill does not do that — `b-iterate` is the next step).
- **Do not invent issues to look thorough.** If the code is clean, say so plainly in the "What's Good" section and keep the report short. A short clean report is more valuable than a padded critical one.
- **In PR mode, the script is the source of truth** for paths, SHAs, and the worktree location. Read from `pr-context.json` with `jq`. Do not re-derive these from your own memory of the script's output.

## Cross-References

- This skill is a **sibling** of `b-review`, not a replacement. `b-review` verifies a plan/spec/phase contract; `code-review` gives an opinionated harsh critique of the code itself with no contract. Use `b-review` for "did we deliver what was planned"; use `/code-review` for "is this code actually good."
- After a `code-review` finds real issues, the natural follow-up is `/b-iterate` (small fixes) or `/b-build` (larger rework). Do not loop back into `code-review` until the changes are committed.
