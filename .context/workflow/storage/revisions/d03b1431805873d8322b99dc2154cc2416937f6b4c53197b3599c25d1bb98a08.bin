---
status: completed
date: 2026-09-23
subject: 2026-09-23.omp-token-attribution
topics: [omp, token-usage, stats, plugin, branch-attribution]
research: [research-omp-token-attribution.md]
iterations: [iterate-omp-token-attribution.md]
memory: [omp-token-attribution-build-2026-09-23.md]
---

# Plan: OMP token attribution by project and feature

## User Goal

Confirmed 2026-09-23: see token counts and estimated dollars per git repo, and per feature inside that repo, across every model. Worktrees of the same repo roll up together. Invoice-accurate billing is out of scope; catalog estimates are enough if labeled as estimates.

## Goal

When this repo is installed as an OMP plugin, every new assistant turn is recorded in `~/.omp/stats.db` with provider, model, token buckets, catalog-or-provider cost, origin-or-git-dir project key, and the git branch at request time. `/tokens` prints the current project's total and per-branch breakdown.

## Context used / assumptions

- User-provided context: attribute all model tokens by provider, model, and token type; roll up by git project across worktrees; tag features by branch; record in a database; ship with `omp install` of this project; forward only; read via a slash command.
- Session context: brainstorm decisions in `brainstorm-omp-token-attribution.md`.
- Artifacts used: `research-omp-token-attribution.md`, `brainstorm-omp-token-attribution.md`.
- Buck capability: full. Probe source: system available-skills catalog (`b-build`, `b-review`, `b-save` all listed).
- Assumptions:
  - v1 writes a plugin-owned `attribution` table in `~/.omp/stats.db`. It does not ALTER OMP's `messages` table. `omp stats` inserts those rows later, so `message_end` cannot update them in time.
  - Project key is `git remote get-url origin` when it succeeds, else absolute `git rev-parse --git-common-dir`. Non-git cwd uses the cwd string and a null branch.
  - Feature is `git rev-parse --abbrev-ref HEAD` at record time. Detached HEAD is stored as `detached/<shortsha>`, not merged into one bucket. No manual override in v1.
  - Forward only. Install does not scan old sessions.
  - Subagent and advisor transcripts may be written by child processes that do not load this plugin. v1 still counts them by scanning the current session's artifact directory (`<session-id>/*.jsonl` next to `getSessionFile()`), using the parent session's project/branch snapshot. `INSERT OR IGNORE` keeps a child plugin's own snapshot if one was written first.
  - Cost is copied from `usage.cost.total` when that object is present. Otherwise cost is null and `cost_source` is `none`. The plugin does not reimplement catalog pricing.
  - `/tokens` is the working command name. If `pi.getCommands()` already has it at wire time, register `token-use` instead and say so in the command description path the tests cover.
  - Identity is also appended as a session custom entry (`buck.token-attribution.identity`) when the branch or project key changes, so a failed sqlite write is not the only copy.

## Scope

- Extension module wired from `extensions/index.ts`.
- Git identity resolver with an injectable runner.
- SQLite writer for `~/.omp/stats.db` `attribution` only.
- Live-session nested JSONL ingest for subagent and advisor files of the current session.
- `/tokens` report: no args = current project, grouped by branch, with provider/model totals. One optional arg filters to a branch name in the current project, or to a project key substring if it does not match a branch.

## Out of scope

- Historical backfill.
- Changing OMP `packages/stats` or the `messages` schema.
- Invoice or subscription-quota reconciliation (`usage_history`, provider billing APIs).
- Manual feature tags, subject-folder tags, PR-number tags.
- A dashboard UI, `omp stats` page, or second database.
- Recording turns from OMP sessions that do not load this plugin (project-scoped install only sees sessions that load that install).

## Affected files

- `extensions/index.ts` — call `wireTokenAttribution(pi)` next to the other `wire*` calls.
- `extensions/token-attribution/index.ts` — new. Events, command, session scan.
- `extensions/token-attribution/git-identity.ts` — new. Origin / common-dir / branch.
- `extensions/token-attribution/db.ts` — new. Open `~/.omp/stats.db`, create `attribution`, insert.
- `extensions/token-attribution/report.ts` — new. Query and format `/tokens` text.
- `extensions/token-attribution/__tests__/git-identity.test.ts` — new.
- `extensions/token-attribution/__tests__/db.test.ts` — new. Temp sqlite, not the user's `stats.db`.
- `extensions/token-attribution/__tests__/report.test.ts` — new.

## Implementation steps

1. Add `git-identity.ts`. Given a cwd and a runner `(args) => stdout`, return `{ projectKey, branch, worktreeRoot, detached }`. Runner failure or non-zero git → non-git identity (`projectKey = cwd`, `branch = null`). Do not spawn a shell; the production runner uses `execFile("git", args, { cwd })`.
2. Add `db.ts`. Resolve the db path as `join(homedir(), ".omp", "stats.db")` unless a test injects a path. `PRAGMA busy_timeout = 5000`. `CREATE TABLE IF NOT EXISTS attribution` with columns: `recorded_at`, `session_file`, `session_id`, `entry_key`, `project_key`, `branch`, `worktree_root`, `provider`, `model`, `api`, `input_tokens`, `output_tokens`, `cache_read_tokens`, `cache_write_tokens`, `reasoning_tokens`, `total_tokens`, `cost_usd`, `cost_source`. Unique on `(session_file, entry_key)`. Insert with `INSERT OR IGNORE`. Never write `messages`, `tool_calls`, `user_messages`, `file_offsets`, or `meta`.
3. Add usage extraction. From an assistant message, read `usage.input/output/cacheRead/cacheWrite/totalTokens`, `reasoningTokens` when present, `provider`, `model`, `api`, and `usage.cost.total` when present. Skip the row when provider, model, or usage is missing. `entry_key` is the session entry id when the event or JSONL line has one; otherwise `timestamp:provider:model:totalTokens`.
4. Wire `message_end` for the current process. Resolve identity from `ctx.cwd` (cache until `HEAD` or cwd changes). Write the row. Append the custom identity entry only when the key changed.
5. After `message_end` and `agent_end`, scan only the current session artifact directory (sibling directory of `ctx.sessionManager.getSessionFile()` whose name is the session file basename without `.jsonl`). Parse assistant messages and `model_usage` lines not yet inserted. Use the parent identity snapshot. Ignore files outside that directory.
6. Register `/tokens`. No args: resolve the current project key, print total tokens, estimated cost, and a per-branch table, then a provider/model table for that project. One arg: if it equals a branch in the current project, filter to it; otherwise treat it as a project-key substring and list matching projects. Empty attribution table prints a one-line "no attributed turns yet" message, not an error.
7. Call the wire function from `extensions/index.ts` beside `wireTpsTracker`.
8. Unit tests for identity resolution, idempotent insert, and report formatting. Tests use a temp database and a fake git runner. No test opens `~/.omp/stats.db`.

## Acceptance criteria

- [x] A new assistant turn in a git repo with `origin` writes one `attribution` row whose `project_key` is that origin URL and whose `branch` is the branch at that moment.
- [x] Two worktrees of the same origin produce the same `project_key` and different `branch` values when their HEADs differ.
- [x] A non-git cwd writes `project_key` = that cwd and `branch` null.
- [x] A second delivery of the same `(session_file, entry_key)` does not add a second row.
- [x] A nested subagent JSONL under the current session directory is ingested without that child loading the plugin, and does not double-count if the child also inserted the row.
- [x] `/tokens` with no args prints the current project's token total and per-branch totals from the attribution table.
- [x] The plugin does not modify OMP-owned stats tables.
- [x] `omp install` of this repo is sufficient to load the recorder. No separate install step.

## Verification

- `npm run test:vitest` scoped to `extensions/token-attribution`, then the repo unit gate if the session is code-touching.
- Throwaway script: temp git repo with origin, fake assistant usage, call the insert function, assert the row. Not a permanent test of sqlite plumbing beyond the idempotency and identity cases above.
- Manual, after the extension is wired: one real OMP turn in this repo, then `sqlite3 ~/.omp/stats.db "SELECT project_key, branch, provider, model, total_tokens FROM attribution ORDER BY recorded_at DESC LIMIT 5;"`. Expect this repo's origin and the current branch. Then `/tokens` prints a non-zero total that includes that turn.
- Nested-file check: after a `task` subagent turn, the same query shows a row whose `session_file` is the nested JSONL, with the parent branch.

## Execution Instructions

This is a non-phased execution-ready plan. Treat the whole plan as one unit:

1. Run `/b-build` against this plan.
2. Run `/b-review` against this plan.
3. If review creates an `iterate-*.md` artifact (in-plan issues), run `/b-iterate`, then re-run `/b-review`. Out-of-plan findings go to a separate `/b-plan` → `/b-build` cycle. If review flags documentation impact, run `/b-docs` before `/b-save`.
4. Run `/b-save`.
5. Run `/b-commit`.
6. If interrupted, resume from this plan.

## Risks

- Writing the user's live `~/.omp/stats.db` can lock or, if the SQL is wrong, corrupt a table. Mitigation: own table only, `busy_timeout`, tests on a temp file, no `DROP`/`DELETE` of existing tables.
- OMP may later add its own `attribution` table. Mitigation: table name `buck_token_attribution` if a pre-flight `sqlite_master` check finds `attribution`. Implementation picks the free name and uses it everywhere, including `/tokens`.
- Branch cached across a checkout in the same process would mis-tag. Mitigation: re-read `HEAD` when the git HEAD file mtime changes, and always re-read on `message_end` if the cache is older than the turn.
- Nested scan could mis-attribute a subagent if the parent branch changes while the child is running. Acceptable for v1; the row keeps the branch observed at ingest.
- Catalog cost on subscription models is not an invoice. `/tokens` must label the dollar figure as estimated.
