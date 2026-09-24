# Plan: OMP token attribution by project and feature

## User Goal
Confirmed 2026-09-23: see token counts and estimated dollars per git repo, and per feature inside that repo, across every model. Worktrees of the same repo roll up together. Invoice-accurate billing is out of scope; catalog estimates are enough if labeled as estimates.

## What we might build

- Database: `~/.omp/stats.db`. The plugin writes an `attribution` table there (project_key, branch, provider, model, token buckets, cost, session_file, entry_id, timestamp). Do not ALTER OMP's `messages` table — `omp stats` creates those rows later, so a `message_end` hook cannot update them in time.
- Feature tag is the git branch at request time. No manual override in v1.
- Project key: `git remote get-url origin` when a remote exists, else the absolute git common dir. Non-git cwd uses the cwd and a null branch.
- Snapshot identity in the session transcript and in that table, so a later branch switch does not rewrite history.
- Forward only. Old rows are not backfilled.
- Read surface: slash command `/tokens`, registered by the same plugin. No args: current project's total and per-branch breakdown. Optional arg selects another project key or a branch.
- Delivery: `omp install` of this repo loads `extensions/index.ts`. That extension records turns and registers `/tokens`.

## Why it matters

Same repo is already split in the live ledger. `buck-workflow-pi` is $622 in the main folder and another ~$220 in sibling worktrees (`autonomous-loop.wt`, `fix-pr-32.wt`, `agent-manage-pr.wt`, `more-informative-llm.wt`). Those checkouts share one `.git` and one origin. Folder slug cannot see that. The main checkout also changes branches, so its folder mixes features.

## Constraints / preferences

- OMP plugin install is the v1 ship path. An upstream `packages/stats` change is not required for v1.
- No second database. No second token meter that replaces stats; this table is the attribution record.
- Token counts are ground truth. Catalog dollars are estimates.
- Subagent and advisor turns count only if those processes load the plugin. User-global install should cover them; verify before calling it done.
- Sibling worktrees join by origin URL, not by folder name.

## Open questions

- None that block a plan. `/tokens` name is a working name.

## Brainstorm notes

- Research: `research-omp-token-attribution.md`
- `client_usage` in `agent.db` is the wrong table (empty, install-global).
- `usage-attribution` in `@oh-my-pi/pi-ai` means cache/orchestration field accounting, not project attribution.
- Session header has `cwd`, not branch. Recent JSONL often starts with a `type:title` record; cwd is on the later `type:session` line.
- 2026-09-23: feature = branch at request time. User wants it recorded in a database.
- 2026-09-23: database = extend `~/.omp/stats.db`.
- 2026-09-23: project key = origin URL, else git common dir.
- 2026-09-23: forward only. No historical backfill.
- 2026-09-23: v1 installs with this project's OMP plugin (`omp install`), not as an upstream stats patch.
- 2026-09-23: read surface = slash command `/tokens`.
