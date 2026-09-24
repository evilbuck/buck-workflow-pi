# Sources — OMP token attribution

Accessed 2026-09-23.

## Local runtime (high)

- `omp --version` → `omp v18.2.11`
- `~/.omp/agent/agent.db` schemas: `client_usage` (0 rows), `usage_history` (3656 quota rows), `usage_cost_history` (0), `model_usage`, `model_perf`
- `~/.omp/stats.db` — 32,344 message rows, 50 folders, 52 provider/model pairs, catalog cost sum $1,873.29
- Session JSONL under `~/.omp/agent/sessions/`. Header `type:session` carries `cwd`. Recent files often start with a `type:title` record; the session header is not always line 1.
- `git worktree list` on `buck-workflow-pi`: main checkout, `autonomous-loop.wt`, `buck-workflow-pi-pr20`, and others share `git-common-dir` `.../buck-workflow-pi/.git` and `origin` `git@github.com:evilbuck/buck-workflow-pi.git`. Current branches differ. `/tmp/buck-workflow-pi-pr-17` is gone.

## OMP docs (high)

- `omp://user-facing-packages.md` — `packages/stats`, `omp stats`, store `~/.omp/stats.db`, reads `~/.omp/agent/sessions/`
- `omp://session.md` — `SessionHeader` fields: `cwd`, `title`, `additionalDirectories`, `parentSession`. No git branch or project id.
- `omp://hooks.md` — extension `ctx.cwd`, `sessionManager`. No usage-attribution hook.

## Upstream source, can1357/oh-my-pi @ search index 3d3ec7e (high for files read)

- `packages/stats/src/db.ts` — `messages` columns: provider, model, api, input/output/cache_read/cache_write/total tokens, cost components, `folder`, `agent_type`, `session_file`. Fork dedupe on `(entry_id, timestamp)`.
- `packages/stats/src/parser.ts` — `extractFolderFromPath` is the session-directory slug, not a git root. `classifyAgentType` labels main / subagent / advisor from path depth. Ingests assistant messages and `model_usage` entries. Drops `reasoningTokens`, `orchestration`, `cttl`, `server` as separate columns.
- `packages/stats/src/gain-aggregator.ts` — `normalizeProjectPath` collapses nested `.wt/`, `.worktrees/`, `-wt/` suffixes only. Does not join sibling checkouts such as `autonomous-loop.wt`.
- `packages/ai/test/usage-attribution.test.ts` — "attribution" here means provider usage-field accounting (cache write vs input, reasoning subset of output, orchestration vs conversation, Anthropic cache TTL). Not project/feature attribution.
- `packages/ai/src/auth/sqlite-credential-store.ts` — creates `client_usage`. Install-global broker ledger, empty locally. Not the session meter.

## This repo (high)

- `extensions/tps-tracker.ts` — reads `event.message.usage.output` on stream events. Proves extensions see per-message usage. Does not persist it.
- `skills/pi-rpc/reference.md` — assistant `usage: {input, output, cacheRead, cacheWrite, cost}` plus `provider`, `model`, `api`.
