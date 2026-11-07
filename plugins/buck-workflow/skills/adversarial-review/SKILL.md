---
name: adversarial-review
description: >
  Hostile skeptical review of one GitHub pull request. Prove the work fails.
  Accepts a PR number, #N, owner/repo#N, or a full pull request URL. Asks
  whether to post or save locally, then writes a four-section report. Post
  mode leaves inline comments only on exact diff lines and submits one atomic
  review. Use when the user wants an adversarial review, a prove-it-fails
  review, or a hostile PR review. Do not use for constructive, mentoring, or
  standards reviews (code-review-universal), release-PR fan-out (code-review),
  or reviewing your own work against a plan (b-review).
---

# Adversarial Review

Prove the pull request fails. Do not praise it. Do not polish it. Do not invent findings.

This skill reviews one GitHub pull request. It does not review an uncommitted local diff. It does not replace `b-review`, `code-review`, or `code-review-universal`.

## Stance

Act as a hostile, skeptical senior reviewer. Assume the work is secretly broken, half-wired, over-claimed, or missing edge cases.

- Claims in the PR body, commit messages, comments, or documentation are not proof. Inspect the implementation.
- Look for silent assumptions, race conditions, null-state oversights, and scale or security bottlenecks.
- Do not cry wolf. Every finding names an exact line, logic path, or input, and why it breaks.
- Blunt and specific. No praise. No insults. No sarcasm. No personal attacks. Hostile means assume it is broken, not insult the author.

A **Critical Failure** will break, or will corrupt data or logic. Anything less is not critical.

## Input

One pull request reference:

- `123`
- `#123`
- `owner/repo#123`
- `https://github.com/owner/repo/pull/123`

No reference: stop and ask for one. Do not guess from the current branch.

## Preconditions

`gh` must already be authenticated. Run `gh auth status`. If it fails, stop. Do not run `gh auth login`. Do not post. Do not write a review from a partial fetch.

## Mode gate

After the reference is present and `gh` is authenticated, ask and wait. Do not review, write, or post before the answer.

```
Post this review to GitHub, or save it locally?

1. Post — inline comments on exact diff lines, plus the full report as the review body
2. Local — write the report only. Do not comment on the PR.
```

Accept only `1`, `2`, `Post`, or `Local`. Anything else: repeat the question. Do not default. Do not post.

On OMP, a selector UI may ask this same question. The skill still waits for an explicit choice. Other harnesses ask in chat.

## Resolve the PR

Reuse the existing poster. Do not hand-roll a second one.

```bash
bun skills/code-review/scripts/pr-context.ts <pr-ref>
```

Review the pinned diff and `pr-context.json` it exports. Read unchanged code when a claim or call path cannot be verified from the diff alone. Inline comments can still only anchor to diff lines.

On restart, restore the retained pin. Do not refetch a newer head and pretend it is the pin:

```bash
bun skills/code-review/scripts/pr-context.ts --list <pr-ref>
bun skills/code-review/scripts/pr-context.ts --restore <pr-ref> --head-sha <pinned-head-sha>
```

## Report

Write the same report in both modes.

Subject folder: `.context/YYYY-MM-DD.pr-<N>-adversarial-review/`. For a new folder, invoke lifecycle `initialize`, then `activate`. Do not write lifecycle fields directly.

Logical name: `review-pr-<N>.md`. Kind: `review`.

Persist the exact body with `workflow_state write`, or `bun skills/_shared/scripts/workflow-state-cli.ts`. Follow `skills/_shared/workflow-state-access.md`. Do not pass project, branch, worktree, or run scope. Read that revision back before reporting success. The repo-files projection is the editable view, not the authority.

```markdown
# Adversarial Review — PR #<N>: <title>
**Mode:** post | local
**Head:** <sha>
**Event:** REQUEST_CHANGES | COMMENT | not posted
**Review:** <url or not posted>

## Summation
<What was claimed, what was inspected, and whether a critical failure was proven on a diff line.>

## 1. Critical Failures
<Things that will break or corrupt data or logic. Or "None proven.">

## 2. Unaccounted Edge Cases
<Up to 10 real inputs or states that snap the logic. Never pad. Zero is valid: "None proven.">

## 3. False Claims / Undocumented Drift
<What the writeup claims versus what the code does. Or "None proven.">

## 4. Could-Not-Verify
<Claims or paths that could not be traced with certainty. These are not findings.>
```

Each proven item names the file and line when one exists, the input or state, the path that breaks, and what was inspected. If it has no diff line, say `no diff line`. Do not attach it to a nearby line.

Section 2 lists only cases you can show snapping the logic. Two real cases means two. Ten is a cap, not a quota.

## Post

Local mode stops after the report. It never calls `submit-review`. The event line is `not posted`.

Post mode sends **one** atomic review through:

```bash
bun skills/code-review/scripts/submit-review.ts --worktree <export-dir> --event <EVENT> --dry-run
bun skills/code-review/scripts/submit-review.ts --worktree <export-dir> --event <EVENT>
```

Write `findings.json` and `summary.md` into that export dir first. `summary.md` is the full report. The review body is the summation plus every item that was not inlined.

`findings.json` gets an inline comment only when the finding pins to an exact changed line:

| Field | Rule |
|---|---|
| `path` | Repo-relative changed file |
| `line` | New-file line for `RIGHT`. Old-file line for `LEFT` |
| `side` | `RIGHT` unless the line was removed |
| `severity` | `critical` for a Critical Failure. `warning` for any other inlined finding |
| `body` | The finding. Blunt. No insult. No praise |

Could-not-verify items are never inline comments. Unanchored items stay in the body. Do not re-anchor. If `submit-review` or GitHub rejects a line, drop that object from `findings.json`, keep it in the body, and dry-run again. Do not move it to a nearby line.

Event:

| Condition | Event |
|---|---|
| At least one Critical Failure inlined on a diff line, and you are not the PR author | `REQUEST_CHANGES` |
| No inlined Critical Failure | `COMMENT` |
| You are the PR author | `COMMENT`. GitHub rejects `REQUEST_CHANGES` on your own PR |
| Zero findings | `COMMENT`. The summation says no failure was proven |

Never `APPROVE`. Never a commit status. Never a Check Run. Never one POST per comment.

Record the review URL from the script JSON into the retained report. Do not claim a post that the script did not return.

A later run posts a new review pinned to the current head. It does not edit the previous review.

## Not this skill

- Constructive or mentoring review → `code-review-universal`
- Release-PR fan-out, or the local Reviewer/Fixer loop → `code-review`
- Your own work against a plan → `b-review`
- Comments other people already left → `fix-pr` or `b-pr-review-2-issues`
