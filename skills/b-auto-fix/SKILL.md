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
- Owning checkout and run ID from pipeline setup (the issue worktree is not the storage owner)
- Run export directory: `<owning-checkout>/.context/auto-fix/<run-id>/issue-<n>/`

## Retained stage handoff

Run/stage/failure evidence is authoritative in the configured run-private adapter. Local paths are exports, not restart inputs. After producing each stage output in a temporary file, retain it before continuing:

```bash
bun <skill_dir>/scripts/auto-fix.ts artifact write <run-id> issue-<n>/<stage>.md <output-file> --cwd <owning-checkout>
bun <skill_dir>/scripts/auto-fix.ts artifact read <run-id> issue-<n>/<stage>.md --cwd <owning-checkout>
bun <skill_dir>/scripts/auto-fix.ts artifact restore <run-id> --cwd <owning-checkout>
```

`<stage>` is research, plan, build, or review. Read previous stages with `artifact read`; `artifact restore` rebuilds all exports after restart. Missing retained inputs or storage errors block continuation; never fall back to a local Markdown copy. PR bodies and hard/soft-fail evidence use the same retained service through the completion helpers.

## Pipeline
Run each stage in order. Retain each stage output through the handoff above.

### 1. b-research
Investigate the issue body, linked files, and codebase.
Retain findings as `issue-<n>/research.md`.

Read `skill://b-research` for the research workflow.

### 2. b-plan
Using research output, create an implementation plan.
Retain as `issue-<n>/plan.md`.

Read `skill://b-plan` for the planning workflow.

### 3. b-build
Implement the plan using TDD.
Retain build summary as `issue-<n>/build.md`.

Read `skill://b-build` for the build workflow.

### 4. b-review
Review the diff against the plan.
Retain verdict as `issue-<n>/review.md`.

Read `skill://b-review` for the review workflow.

## Failure routing
- If any stage produces an error: classify per `hard_fails` list
- If b-review blocks: report `review_blocked` as hard-fail

## Output
All evidence is retained under the owning checkout's trusted run-private scope. The retained `review.md` determines success/fail; `<run-dir>/` contains optional exports.

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
