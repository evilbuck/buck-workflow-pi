---
name: b-auto-fix
description: Auto-fix a single GitHub issue by running b-research → b-plan → b-build → b-review
version: 1.0.0
---

# b-auto-fix: Per-issue pipeline

## Context
You are processing a single GitHub issue in an isolated worktree.

## Inputs
- Issue number, title, body
- Worktree path (your cwd)
- Run state directory: `.context/auto-fix/<run-id>/issue-<n>/`

## Pipeline
Run each stage in order. Write stage output to the run state directory.

### 1. b-research
Investigate the issue body, linked files, and codebase.
Write findings to `<run-dir>/research.md`.

Read `skill://b-research` for the research workflow.

### 2. b-plan
Using research output, create an implementation plan.
Write to `<run-dir>/plan.md`.

Read `skill://b-plan` for the planning workflow.

### 3. b-build
Implement the plan using TDD.
Write build summary to `<run-dir>/build.md`.

Read `skill://b-build` for the build workflow.

### 4. b-review
Review the diff against the plan.
Write verdict to `<run-dir>/review.md`.

Read `skill://b-review` for the review workflow.

## Failure routing
- If any stage produces an error: classify per `hard_fails` list
- If b-review blocks: report `review_blocked` as hard-fail

## Output
All artifacts in `<run-dir>/`. Verdict in `review.md` determines success/fail.

## CLI

The `scripts/auto-fix.ts` script orchestrates the full loop: fetch issues → create worktrees → run agent pipeline per issue → push/PR on success.

```bash
bun run skills/b-auto-fix/scripts/auto-fix.ts -- --repo owner/repo [flags]
```

### Flags

| Flag | Default | Description |
|------|---------|-------------|
| `--repo <owner/repo>` | — | **Required.** Target GitHub repo |
| `--assignee <user>` | `@me` | GitHub user to filter issues by |
| `--base <branch>` | auto-detect | Base branch (tries main/master/dev) |
| `--dry-run` | `false` | Preview mode — no push, no PR, no comment |
| `--list` / `--list-only` | `false` | List issues that would be processed, then exit. No worktrees, no run state, no side effects. |
| `--format <human\|json>` | `human` | Output format for `--list` mode. `json` emits a structured object. |
| `--config <path>` | `auto-fix.config.json` | Config file path |
| `--max-issues <n>` | `10` | Safety cap per run |
| `--yes` | `false` | Skip first-run safety prompt |
| `--help` | — | Show help text |

### Observation modes
`--dry-run` and `--list` are the two non-destructive modes. They differ in how invasive they are:
| Mode | Worktrees | Run state dir | Push / PR / comment | Output |
|------|-----------|---------------|--------------------|--------|
| (default) | yes | yes | yes | pipeline setup |
| `--dry-run` | yes | yes | no | staged artifacts |
| `--list` | **no** | **no** | no | formatted list of issues (to-process + skipped) |

Use `--list` to preview the queue before committing to a full run. It does not write to disk, does not trigger the first-run safety prompt, and exits as soon as the list is printed.

### Config file

Place `auto-fix.config.json` in the target project root. CLI flags override config. Local overrides go in `auto-fix.config.local.json` (gitignored).

| Key | Type | Default |
|-----|------|---------|
| `labels_skip` | `string[]` | `["in-progress", "do-not-auto-fix", "human-only"]` |
| `hard_fails` | `string[]` | `["gh_unreachable", "git_push_failed", "tests_failed_after_build", "review_blocked"]` |
| `branch_prefix` | `string` | `"auto-fix/issue-"` |
| `worktree_dir` | `string` | `".."` |

### Hard-fail recovery

| Failure mode | Action |
|-------------|--------|
| `gh_unreachable` | Check `gh auth status` and network |
| `git_push_failed` | Check remote permissions, push manually |
| `tests_failed_after_build` | Inspect worktree, fix tests, push |
| `review_blocked` | Read review.md, fix issues, re-run |
