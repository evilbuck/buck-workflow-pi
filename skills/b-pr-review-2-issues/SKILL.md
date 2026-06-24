---
name: b-pr-review-2-issues
description: Ingest all comments from a GitHub PR (URL or number), classify them, group by topic/theme, and produce a buck-workflow plan (or phased plan) artifact. Stops at the plan — no issue creation. Use when turning PR review feedback into structured implementation work.
aliases: [pr-review-2-issues]
---

# b-pr-review-2-issues: PR Solutions Agent

Process all review comments from a GitHub pull request and produce a buck-workflow plan (or phased plan) artifact. **Not a code reviewer** — it ingests *other people's* comments, classifies them, groups by semantic theme, and writes a plan following `b-plan` / `b-phase` conventions.

**Primary output**: A `.context/` plan artifact. No GitHub issues are created — that is a downstream step.

## Prerequisites

| Tool | Purpose |
|---|---|
| `git` | worktree creation, branch operations |
| `gh` | PR comment fetch |

## Invocation

```
/b-pr-review-2-issues              # interactive: paste/select PR
/b-pr-review-2-issues <pr-number>  # use this PR directly
/b-pr-review-2-issues <pr-url>     # use this PR URL
```

## Procedure

### Phase 1: PR Identification

If a PR number or URL is provided, parse it. Otherwise:
1. Ask the user for a PR URL or number
2. Parse and validate it exists

Extract:
- PR number
- PR title
- PR body
- Head branch (`headRefName`)
- Base branch (`baseRefName`)
- State (open/closed/merged)

### Phase 2: Worktree Setup (Conditional)

1. Get the current branch: `git rev-parse --abbrev-ref HEAD`
2. **If current branch ≠ PR head branch**, create a worktree:
   ```bash
   mkdir -p ../.worktrees
   git worktree add ../.worktrees/<head-branch> <head-branch>
   cd ../.worktrees/<head-branch>
   ```
3. **If current branch = PR head branch**, stay in place
4. Report the working directory

### Phase 3: Comment Ingestion

Fetch all comments:
```bash
gh pr view <number> --comments --json comments
```

For each comment, first inspect its file path:
- If `file` starts with `.context/`, classify it as `context_skip` — these are research and development artifacts, not deliverables. Write the comment artifact as usual, but exclude it from grouping and the implementation plan. Record the skipped count in the summary.

For each comment, write `.context/<subject>/comment-<N>.md`:
```markdown
---
pr_comment_id: <id>
author: <github-username>
file: <path-or-null>
line: <line-or-null>
date: <ISO-date>
type: <classified-type>
---

# Comment <N>

<original comment body>
```

### Phase 4: Comment Classification + Deduplication

1. **Classify each comment** into one of:
   - `actionable` — suggests a change, reports a bug, requests a fix
   - `question` — asks for clarification, ends with `?`
   - `nit` — "nit", "LGTM", stylistic-only, minor formatting
   - `duplicate` — exact same body + same author + same file as another comment
   - `context_skip` — comment is on `.context/**` session artifacts (research and development notes, not deliverables)
2. **Deduplicate**: exact match only (identical body text + same author + same file path). Near-dupes stay separate.

### Phase 5: Subject Folder + Theme Grouping

1. **Create subject folder**: `.context/YYYY-MM-DD.<pr-number>-<kebab-title>/`
   - Example: `.context/2026-06-12.42-fix-auth-middleware-race/`
2. **Create `index.md`** with `status: active`
3. **Move comment files** into the subject folder
4. **Group actionable + question comments by topic/theme**:
   - AI reads comment bodies and infers semantic themes (auth, error handling, tests, UI, performance, etc.)
   - Comments on the same conceptual concern → same group, regardless of file
   - Produce a grouping table and **present it to the user for approval**

### Phase 6: User Approval of Groups

Present the grouped comments:

```markdown
## Proposed Comment Groups

### Group 1: <theme-name> (<N> comments)
- Comment 3 (by @alice) — `src/auth.ts:42`: "The token expiry logic is wrong..."
- Comment 7 (by @bob) — `src/middleware.ts:15`: "This should use the shared auth util..."
- Comment 12 (by @alice) — `tests/auth.test.ts:88`: "Add a test for expired tokens..."

### Group 2: <theme-name> (<N> comments)
- Comment 2 (by @carol) — `src/api.ts:10`: "Error response format doesn't match spec..."
...

---
Approve these groups? [y / edit / re-group]
```

- **y** → proceed to Phase 7
- **edit** → let user merge, split, or reassign comments, then re-present
- **re-group** → re-infer with different criteria, then re-present

### Phase 7: Plan or Phased Plan Creation

Follow `b-plan` conventions. Determine scope:

| Threshold | Action |
|---|---|
| ≤8 steps, ≤5 files, single layer | Single `plan-pr-solutions.md` |
| >8 steps OR >5 files OR multi-layer | Phased plan: `plan-*-phases.md` + `phase-N-*.md` |

**Subject folder frontmatter** (`index.md`):
```yaml
---
status: active
date: YYYY-MM-DD
subject: YYYY-MM-DD.<pr-number>-<kebab-title>
topics: [pr-review, feedback, <theme-slugs>]
source_pr: <pr-number>
source_pr_url: <url>
---
```

**Plan frontmatter**:
```yaml
---
status: active
date: YYYY-MM-DD
subject: YYYY-MM-DD.<pr-number>-<kebab-title>
topics: [pr-review, feedback, <theme-slugs>]
research: []
spec: null
memory: []
---
```

**Plan body structure**:
```markdown
# Plan: PR #<N> Review Solutions

## User Goal

Resolve all review feedback on PR #<N>: <pr-title>

## Goal

Implement changes grouped by concern theme, addressing each comment systematically.

## Context used / assumptions

- Source: PR #<N> — <pr-url>
- Comments ingested: <total> (actionable: <N>, questions: <N>, nits: <N>, duplicates: <N>, context-skipped: <N>)
- Groups: <N> themes (see grouping table below)

## Scope

- All `actionable` comments addressed
- All `question` comments answered in implementation or marked as follow-up
- `nit`, `duplicate`, and `.context/**` session-context comments excluded

## Out of scope

- Comments classified as `context_skip` because they target `.context/**` session artifacts
- Comments on unrelated concerns

## Affected files

<union of all files from comments>

## Implementation steps

Per group:
1. **<group-theme>**: <one-sentence summary>
   - Address comment <N> (see `comment-<N>.md`)
   - Address comment <M> (see `comment-<M>.md`)
   - ...

## Verification

- [ ] All actionable comments resolved
- [ ] Tests pass for affected files
- [ ] Re-request review from original commenters

## Risks

- Conflicting feedback from different reviewers
- Code may have diverged from PR comments since they were written

## Comment Grouping

<reproduce the approved grouping table>
```

**If phased**, also write `phase-N-<slug>.md` files per group:
```yaml
---
status: active
date: YYYY-MM-DD
phase_number: N
phase_total: M
depends_on: []          # [1] for phase 2, [1,2] for phase 3, etc.
difficulty: easy | medium | hard
acceptance_criteria:
  - "All comments in group N addressed"
  - "Tests pass for affected files"
ralph_mini_cycle: |
  1. Run /b-build or /b-build-hard against this phase file
  2. Run /b-review against this phase file
  3. If review creates iterate-*.md, run /b-iterate, then re-run /b-review
  4. If /b-review flags documentation impact, run /b-docs
  5. Run /b-save, then /b-commit, then ralph_done
---
```

### Phase 8: Report

```text
PR solutions plan created: PR #<N> — <title>
  Subject folder: .context/YYYY-MM-DD.<pr-number>-<kebab-title>/
  Comments ingested: <total> (actionable: <N>, questions: <N>, nits: <N>, duplicates: <N>, context-skipped: <N>)
  Groups: <N> (user-approved)
  Plan: .context/<subject>/plan-pr-solutions.md
  Phases: <N> (or: single plan)
  Worktree: <path> (if created; clean up: git worktree remove <path>)
```

## Behavior Rules

- **Read-only on source code** — only writes to `.context/`
- **Never dismiss or resolve PR comments** — only classify them
- **Worktree cleanup**: report the path; do NOT auto-delete
- **Grouping requires user approval** before writing the plan
- **Classify all comments** — nothing skipped without a reason
- **Ignore `.context/**` review comments** — they are research and development artifacts (notes, plans, memory), not deliverables
- **Deduplicate**: exact match only (body + author + file)
- **No GitHub issue creation** — stops at the plan artifact

## Error Handling
- **gh not installed**: "GitHub CLI (gh) not found. Please install it first."
- **Not authenticated**: "Not authenticated with GitHub. Run `gh auth login`."
- **Worktree exists**: If `../.worktrees/<branch>` already exists, cd into it instead of creating
- **Branch not found on remote**: "Branch not found. Fetch first: `git fetch origin`"
- **Invalid PR**: "PR <number> not found or not accessible."

## Downstream Workflow

After the plan is created:
1. Review the plan (it's in `.context/` — open and read)
2. Use `/b-build` or `/b-build-hard` to implement phase by phase
3. Optionally create GitHub issues manually from the groups
4. Use `/b-review` to verify each phase
5. Use `/b-save` → `/b-commit` when done
