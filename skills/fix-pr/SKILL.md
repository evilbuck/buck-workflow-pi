---
name: fix-pr
description: >
  Review comments on a GitHub PR, validate each against the code, size the
  collective, then either fix+commit+push in-session or file GitHub issues.
  Ask the engineer only when validity is genuinely unclear. Use when the user
  wants PR review feedback actioned (not just planned), says "fix the PR
  comments", "address review feedback", or points at a PR URL/number for fixes.
  OMP-first tooling; procedure is agent-agnostic. Load by skill name
  (e.g. /skill:fix-pr) — no slash-command prompt wrapper.
---

# fix-pr: Validate & Act on PR Review Comments

Ingest review feedback on a GitHub pull request, **validate** each comment
against current code, estimate size, then either **fix in this session** or
**file issues**. Commit and push when you fix.

This is **not** a code reviewer and **not** a planner-only skill.

| Skill | Stops at | Mutates code? |
|---|---|---|
| `code-review` / `code-review-universal` | Posts a review | No |
| `b-pr-review-2-issues` | Plan artifact in `.context/` | No |
| **`fix-pr`** | Fixed code **or** filed issues | **Yes** (when small) |

## Surface — skill only (no prompt wrapper)

Shipped as **`skills/fix-pr/SKILL.md` only**. There is **no**
`prompts/fix-pr.md` and **no** `commands/fix-pr.md` symlink.

Invoke by loading the skill by name:

| Harness | Typical invoke |
|---|---|
| **OMP** (primary) | `/skill:fix-pr` or skill auto-load from description match |
| Pi | skill-by-name / description match |
| Claude Code / Cursor / Codex / OpenCode | load skill content; follow this doc |

Do **not** add a thin prompt wrapper "for slash discovery." Wrappers drift and
rarely carry the full procedure. If a slash alias is wanted later, it is a
separate registry change — not required for this skill to work.

## Harness posture: OMP-first, agent-agnostic

**Procedure is portable.** Every phase is expressible with `git` + `gh` + the
project test runner. Any coding agent that can run those can execute this skill.

**Tooling preference when multiple options exist (OMP first):**

| Need | Prefer on OMP | Fallback (any agent) |
|---|---|---|
| Read PR + comments | `pr://N`, `pr://N?comments=1`, or GitHub/`gh` tool | `gh pr view`, `gh api …/pulls/N/comments` |
| Checkout PR head | GitHub `pr_checkout` / `gh pr checkout` | `git fetch` + checkout / worktree |
| Create issue | `gh issue create --body-file` | same |
| Commit | project `git-commit` skill if present | `git commit` conventional message |
| Memory | `.context/memory/` per global AGENTS.md | same paths |

Rules:

- Detect harness from **runtime/session** signals (`omp` tools, `pr://`, etc.).
  Do **not** treat `package.json`'s `omp` field as "we are on OMP" — packages
  declare it regardless of who loads them.
- Never require OMP-only APIs to complete the job. If `pr://` is missing, use `gh`.
- Never mention or depend on a prompt-wrapper path.

## Prerequisites

| Tool | Purpose |
|---|---|
| `git` | branch check, commit, push |
| `gh` | PR + comment fetch, issue create (auth required) |
| project test runner | verify fixes (narrowest suite that covers the change) |

## Inputs

```
fix-pr
fix-pr <pr-number>
fix-pr <pr-url>
fix-pr <pr> --issues-only      # never fix; file issues for valid items
fix-pr <pr> --fix-only        # never file issues; stop if too large
fix-pr <pr> --dry-run         # validate + inventory only; never mutate repo/PR

If no PR is given: resolve open PR for the current branch via `gh pr view`;
if none, ask for URL/number.

## Size heuristic (single-session vs issues)

Treat the **collective of valid, still-open findings** as one unit:

| Signal | Lean **fix now** | Lean **file issues** |
|---|---|---|
| Valid findings | ≤ ~5 | ≥ 6, or many unrelated themes |
| Files touched | ≤ ~8 | > 8 or many subsystems |
| Depth | Guard/branch/test tweaks, small UX | Design changes, migrations, multi-layer refactors |
| Risk | Local, well-tested paths | Auth/payments/data loss, unclear product calls |
| Time shape | One focused commit (or two) | Multi-session / needs product input |

**Default when borderline:** file issues. Shippable tracking beats a half-finished
branch. `--fix-only` / `--issues-only` override.

Nits / pure style: optional drive-by while editing a file, or skip in the report.
Do **not** file issues for nits.

## Procedure

### Phase 1 — Identify PR + land on head branch

1. Resolve PR number/URL from the invoke args or current branch.
2. Fetch full feedback (review bodies alone are **not** enough):

   **OMP-preferred:**
   ```text
   read pr://<N>
   read pr://<N>?comments=1
   ```
   or the session's GitHub tool equivalent.

   **Universal fallback:**
   ```bash
   gh pr view <N> --repo <owner/repo> --json number,title,body,headRefName,baseRefName,state,url,files,reviews,comments
   gh api repos/{owner}/{repo}/pulls/<N>/comments
   gh api repos/{owner}/{repo}/issues/<N>/comments
   ```

   `--repo <owner/repo>` is required when running out-of-tree or under `--dry-run`
   (no checked-out PR head yet). For `--dry-run` on a third-party repo, pass it
   explicitly: `gh pr view <N> --repo evilbuck/partypic --json ...`.

   **Fast path (recommended when `gh` + `jq` are present):**
   ```bash
   bash skills/fix-pr/scripts/fetch-feedback.sh <owner/repo> <pr-number>
   ```
   Merges the three calls above into one ordered, commit-pinned feed ready for
   the Phase 2 working table. Falls back silently to raw `gh` if the script or
   `jq` is missing.

   **Changed files & code at head:** Phase 3 needs both. Use `gh pr diff` for
   the full diff and the contents API for a single file at head.
   ```bash
   gh pr diff <N> --repo <owner/repo>                          # full diff
   gh api repos/{owner}/{repo}/contents/<path>?ref=<headRefName>  # one file at HEAD
   ```
   Gotcha: `gh pr diff <N> -- <path>` (path-filtered form) emits empty output
   for some PRs even when the file is changed — use the contents API instead.

### Phase 2 — Inventory comments

Include:

- Submitted review bodies (human + bot) with concrete findings
- Inline / file review comments and threads
- Conversation comments that request changes

When a PR has multiple reviews, sort by `submittedAt`; treat the latest review
touching a file/line as authoritative. Tag each finding with its review's
commit SHA so a fix landed in a later commit is detected as `stale` / `already_done`.

| Class | Rule |
|---|---|
| `resolved` threads | Skip unless user asked to re-check |
| `nit` / LGTM / pure style | Optional drive-by; no issue |
| `duplicate` | Across all reviews + inline + conversation — same claim or root cause → one work item, cite every source incl. earliest `submittedAt` |
| `stale` | Finding valid at an earlier review commit but superseded on HEAD → re-validate against HEAD; mark `already_done` with evidence, do not re-fix |
| `.context/**` only | Skip (session artifacts), **except** leaked secrets → actionable |
| Already fixed on HEAD | `already_done` + evidence; do not re-fix |
| Out of scope / drive-by redesign | `out_of_scope`, or ask if product-ambiguous |

Working table:

`# | source | commit | path:line | claim | submittedAt | status: pending_validation`

### Phase 3 — Validate each item against code

For every pending item:

1. Read the cited code **and** callers/siblings that share the root cause.
2. Confirm or disprove with evidence (snippet, test, runtime).
3. Classify:

| Verdict | Meaning | Next |
|---|---|---|
| `valid` | Bug, missing guard, real inconsistency, clear improvement | Count toward size; fix or issue |
| `invalid` | Wrong, outdated, or contradicts deliberate design (with evidence) | Note why; do not fix |
| `already_done` | HEAD already addresses it | Cite proof |
| `unsure` | Needs product/steward call | **Ask the engineer** (below) |
| `nit` | Style-only | Optional / skip |

**Unsure protocol (short, batched):**

```text
Comment <N> (@author, path:line):
  Claim: <one sentence>
  Observed: <what code actually does>
  Why unclear: <missing product intent / two reasonable designs>
  Options: (A) …  (B) …
Valid? → fix / issue / skip per your call.
```

Do not block unrelated **valid** fixes on an open `unsure`.

**Root-cause bias:** one shared guard beats N call-site patches.

### Phase 4 — Size gate

Sum **valid** items still open (exclude `already_done`).

| Gate | Action |
|---|---|
| Within session and not `--issues-only` | Phase 5a Fix |
| Too large and not `--fix-only` | Phase 5b Issues |
| `--fix-only` but too large | Stop; report inventory + recommended issue split; no partial slog |
| Zero valid | Report and stop (no commit) |
| `--dry-run` (any valid count) | Stop after Phase 3; emit inventory + verdict table; no fix, issue, commit, or push |

`--dry-run` short-circuits Phase 5 entirely; the memory artifact (Phase 6) is
still written because the diagnosis is worth keeping, but the repo and PR are
not touched.

### Phase 5a — Fix path

1. Smallest correct diff for all valid items (shared root cause → one change).
2. Narrowest tests that fail if the fix regresses.
3. Run those tests (+ any project-required checks for touched paths).
4. Commit (one preferred; two max if bookkeeping must split):

   ```text
   fix(<scope>): address PR #<N> review (<short theme>)
   ```

   Use the repo's commit skill if present; otherwise plain `git commit`.
5. `git push -u origin HEAD` (current branch).
6. Optional brief PR comment summarizing what landed.
7. Phase 6.

Do **not** expand into unrelated refactors. Do **not** push failing verification.

### Phase 5b — Issues path

For each valid item or tight theme-group:

1. `gh issue create --body-file …` with:
   - actionable title
   - claim, evidence, paths, acceptance criteria
   - links to PR + comment URL
   - labels: `ready-for-agent` if fully specified, else `needs-triage`; plus `bug`/`enhancement` as fit
2. Prefer **one issue per theme** when comments share a root cause.
3. Short PR comment listing filed issues.
4. Do not implement on this path unless a single trivial valid item remains
   and `--issues-only` was not set.

Search existing open issues for the same PR/theme before creating duplicates.

### Phase 6 — Durable record + closeout

Always (agent-agnostic paths):

1. `.context/memory/fix-pr-<pr>-YYYY-MM-DD.md` (or active subject folder) with:
   - PR URL/number
   - validation table (verdict per comment)
   - fix SHAs **or** issue URLs
   - commands run + results
2. Update `.context/memory/index.md`
3. Closeout:

```text
PR #<N> — <title>
Branch: <head> (pushed: yes/no)

Validation:
| # | claim | verdict | disposition |
|---|---|---|---|
| 1 | … | valid | fixed in <sha> |
| 2 | … | invalid | <reason> |
| 3 | … | unsure | asked → <decision> |
| 4 | … | valid | issue #M |

Verification:
- <command> → <result>

Follow-ups: <none | issue links>
```

## Behavior rules

- **`--dry-run` is no-mutate.** Diagnosis only; never checkout-away dirty work,
  commit, push, or open issues under `--dry-run`. (Checkout onto the PR head for
  *reading* code is allowed; mutation is not.)

- **Validate before mutating.** No drive-by "fixes" for unchecked comments.
- **Evidence over deference.** Seniority does not validate a wrong comment.
- **Ask only for `unsure`.** Valid / invalid / already_done are the agent's job.
- **No plan-only theater.** Small → fix. Huge planning need → hand off to
  `b-pr-review-2-issues` / `b-plan` instead of misusing this skill.
- **Correct branch only.**
- **Narrow verification** unless project rules demand more.
- **Secrets** in comments/diffs → actionable; never copy secret values into
  issues or memory.
- **Bots:** concrete findings count; ignore "CI still running" noise.
- **Idempotent re-runs:** re-validate; skip `already_done`; don't duplicate issues.

## Error handling

| Situation | Response |
|---|---|
| `gh` missing / unauthenticated | Stop; install / `gh auth login` |
| PR not found | Stop; ask for URL |
| Checkout fails | Stop; report |
| Tests fail after fix | Fix or revert; do not push red |
| Push rejected | Report; no force-push unless user explicitly orders it |
| Cannot create issues | Report valid items + draft bodies under `.context/` |

## Related skills

- `b-pr-review-2-issues` — plan-only ingestion (no code mutation)
- `b-issue-create` — richer AFK handoff from plan/spec context
- `b-iterate` — small follow-ups after fixes land
- `git-commit` — conventional commit helper when present
- `code-review-universal` — authoring reviews (opposite direction)
