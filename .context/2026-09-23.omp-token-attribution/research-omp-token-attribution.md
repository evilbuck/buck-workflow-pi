---
status: active
date: 2026-09-23
subject: 2026-09-23.omp-token-attribution
topics: [omp, token-usage, stats, git-attribution, worktree, cost]
informs: [brainstorm-omp-token-attribution.md, plan-omp-token-attribution.md]
---

# OMP token attribution by project and feature

## Question

How can OMP attribute token use by provider, model, and token type, then roll it up by git project and by feature, so linked worktrees do not split one repo?

## Answer

Do not build a second meter. OMP already records every assistant turn in `~/.omp/stats.db` via `omp stats` / `packages/stats`. The missing piece is identity: a stable project key, and a feature tag snapshotted at request time.

## What is already metered

`~/.omp/stats.db` `messages` (this machine, 2026-09-23):

| Fact | Value |
|---|---|
| Rows | 32,344 |
| Folders | 50 |
| Provider/model pairs | 52 |
| Catalog cost sum | $1,873.29 |
| Agent split | main 24,713 / $1,638; subagent 6,116 / $148; advisor 1,515 / $87 |

Per row, already stored:

- provider, model, api
- input, output, cache_read, cache_write, total tokens
- cost_input, cost_output, cost_cache_read, cost_cache_write, cost_total, cost_unpriced
- premium_requests, duration, ttft, stop_reason
- folder (session-directory slug), session_file, timestamp, agent_type

Ingest walks every `*.jsonl` under `~/.omp/agent/sessions/`, including nested subagent and `__advisor.jsonl` transcripts. Forks are deduped on `(entry_id, timestamp)` so a forked session does not double-count.

`client_usage` in `agent.db` is a different ledger (auth broker, install-global). It is empty here. Ignore it.

`usage_history` is provider quota windows (`used_fraction`), not tokens.

## What the usage object has that stats drops

Provider parsers already normalize, on the assistant message in the JSONL:

- `input`, `output`, `cacheRead`, `cacheWrite`, `totalTokens`, `cost`
- `reasoningTokens` (subset of output; not added again)
- `orchestration.{input,output,cacheRead}` (Responses / Codex; kept out of conversation buckets, included in `totalTokens`)
- `cttl` (Anthropic 5m/1h cache creation)
- `server` (Anthropic server-tool request counts)
- `premiumRequests`

Stats persists the conversation buckets and cost, and folds orchestration into `total_tokens` only when the provider total is missing. Reasoning, orchestration, cache TTL, and server-tool counts are not columns. They are recoverable by re-parsing JSONL.

`packages/ai/test/usage-attribution.test.ts` is this field accounting. It is not project attribution.

## Why folder is not a project

`extractFolderFromPath` stores the first directory under `~/.omp/agent/sessions/`. That slug is the cwd with `/` flattened, not a git root.

Live proof, same repo, three session folders:

| Worktree | Stats folder | Current branch | git common dir |
|---|---|---|---|
| `.../buck-workflow-pi` | `-projects-development_tools-buck-workflow-pi` | `brainstorm/buck-loop-model-profiles` | `.../buck-workflow-pi/.git` |
| `.../autonomous-loop.wt` | `-projects-development_tools-autonomous-loop.wt` | `test-buck-loop` | same `.git` |
| `.../buck-workflow-pi-pr20` | (separate slug) | `feat/b-kickoff-goal-prompt` | same `.git` |

All three share `origin` `git@github.com:evilbuck/buck-workflow-pi.git`.

Cost sitting outside the main folder, same repo family:

| Folder | Catalog $ |
|---|---|
| buck-workflow-pi | 621.66 |
| autonomous-loop.wt | 102.73 |
| fix-pr-32.wt | 51.28 |
| agent-manage-pr.wt | 42.60 |
| more-informative-llm.wt | 23.75 |

`normalizeProjectPath` in `gain-aggregator.ts` only strips nested suffixes (`.wt/<name>`, `.worktrees/<name>`, `-wt/<name>`). It does not join sibling checkouts. A `.wt` directory name is not enough: `qr.pull-requests.wt` is a different repo.

Session header (`type:session`) stores `cwd`, `title`, `additionalDirectories`, `parentSession`. It does not store branch, worktree, or origin. Recent files often start with a `type:title` line; the session header is later in the file.

Deleted worktrees (`/tmp/buck-workflow-pi-pr-17`) cannot be resolved with git after the path is gone. Historical join needs the cwd (or origin) captured while the session existed.

## Feature tag

Branch is the right default, but it must be snapshotted per request. The main checkout changes branches; its stats folder mixes every feature ever worked there. A linked worktree is often one feature, so its directory name is a usable historical proxy, not a substitute for branch-at-time.

Branch is not in the transcript. Current `HEAD` of a surviving worktree is "branch now", not "branch then". Reflog reconstruction is lossy. Historical feature tags should be `unknown` unless a worktree-name proxy is explicitly accepted.

## Cost vs tokens

Token counts are the ground truth. Dollars in `stats.db` are catalog estimates, with these traps:

- Subscription / oauth providers can be priced from a public fallback card (`xai-oauth` → `xai`) or stored as $0 (`minimax-code`: 3,423 requests, $0).
- OpenRouter can carry the provider-reported charge on `usage.cost`.
- `cost_unpriced` marks scheduled cards with no request timestamp. A zero is not always "free".

Rollups should show tokens always, and label cost as estimate unless `usage.cost` was provider-reported.

## How to accomplish it

### Recommended: extend the stats ingest, don't add a side ledger

1. When a session starts, and again whenever `HEAD` changes, write a small identity record (session header fields or a `custom` entry):
   - `project_key`: `git remote get-url origin` if present, else absolute `git rev-parse --git-common-dir`
   - `worktree_root`: `git rev-parse --show-toplevel`
   - `branch`: `git rev-parse --abbrev-ref HEAD` (`detached` + sha when detached)
   - `feature`: branch, unless an explicit override is set
2. Non-git cwd: `project_key = cwd`, `feature = null`.
3. Parser copies those fields onto each `messages` row (and tool_calls / user_messages if those rollups should match). Subagent and advisor files inherit the parent session's identity; they already live under the parent session directory.
4. Add query/API: by `project_key`, by `project_key + feature`, still broken down by provider, model, and token bucket.
5. Optional columns for the dropped buckets (`reasoning`, `orchestration_*`, `cttl_*`) so "whatever we have" is queryable without re-reading JSONL.
6. Backfill project key from session `cwd` when the path still exists. Do not invent historical branches. Optional flag: treat worktree directory basename as feature when branch is unknown.

This covers main, subagent, advisor, and forks, because they already flow through one parser. An extension on `message_end` does not, unless every subagent process loads it, and it will not show up in `omp stats`.

### Not recommended

- New sqlite written only by a buck-workflow extension. Duplicates ingest, misses transcripts the extension never sees, splits from `omp stats`.
- Joining on the `.wt` suffix. False merges and missed siblings (`buck-workflow-pi-pr20` has no `.wt` suffix and is the same repo).
- Using `client_usage`. Wrong grain, empty, no project.

### What a local prototype can do before an OMP change

Read-only: join `stats.db.session_file` → session header `cwd` → live `git rev-parse --git-common-dir` / `origin`. That answers "how expensive is this repo" for worktrees that still exist. It cannot answer "how expensive was this branch" for past sessions in the main checkout.

## Open questions

- Feature default: branch only, or branch with an explicit override (`/tag`, subject folder, PR number)?
- Project key: origin URL (stable across machines) vs git common dir (stable on one machine, breaks if the repo moves)?
- Historical backfill required, or forward-only plus a one-shot project rollup?
- Ship as an upstream `oh-my-pi` change, or a local query tool first?

## Confidence

- Local schema, row counts, worktree git identity: high (queried).
- Parser and stats schema: high (upstream source read).
- Session header field list: high (OMP docs + a live file).
- Exact write site for a new identity record: medium. Not located line-by-line; the session writer is the place, and the parser is the consumer. A plan should pin the writer before coding.
