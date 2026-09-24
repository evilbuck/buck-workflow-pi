# Rolling notes — OMP token attribution

## Question

How can OMP attribute token use by provider, model, and token type, then roll it up by git project and feature (branch / worktree), independent of which worktree the session ran in?

## Local runtime (omp 18.2.11, `~/.omp/agent/agent.db`)

### What exists

- `client_usage`: provider, model, requests, input/output/cache_read/cache_write tokens, cost_usd, app, install_id, recorded_at. **0 rows** on this machine. Schema is install-global, not project-scoped.
- `usage_history` (3656 rows): provider quota windows (used_fraction, resets_at). Not a token ledger.
- `usage_cost_history`: provider account cost snapshots. **0 rows**.
- `model_usage`: last-used timestamp per `provider/model`. 53 rows. No token counts.
- `model_perf`: smoothed output tokens, gen_ms, ttft per model. Performance, not attribution.
- `clients`: install_id + hostname. No project.

### Session layout already splits worktrees

`~/.omp/agent/sessions/` directories are cwd-derived:

- `-projects-development_tools-buck-workflow-pi`
- `-projects-development_tools-buck-workflow-pi-pr20`
- `-projects-development_tools-fix-pr-32.wt`

Same git project, different session roots. This is the rollup problem.

### Extension surface already sees per-message usage

`extensions/tps-tracker.ts` reads `event.message.usage.output` on `message_update` / `message_end`.

Pi RPC assistant message shape (`skills/pi-rpc/reference.md`):

`usage: { input, output, cacheRead, cacheWrite, cost: { ..., total } }` plus `provider`, `model`, `api`.

Hook `ctx` includes `cwd` and `sessionManager`. No documented project/branch/feature field.

## Upstream signals (can1357/oh-my-pi, code search 2026-09-23)

- `packages/stats/` has its own DB (`packages/stats/src/db.ts`) with token columns and tests for cost, fork dedup, agent type.
- `packages/ai/test/usage-attribution.test.ts` exists — attribution is a first-class concept in `@oh-my-pi/pi-ai`, not only a stats rollup.
- `client_usage` is created in `packages/ai/src/auth/sqlite-credential-store.ts` (auth broker wire), which explains why the local table can be empty if the broker path is not the session ledger.

## Confidence

- Local schema and emptiness: high (queried).
- Session path split: high (listed).

- Upstream stats/attribution packages: high after source read (`packages/stats`, usage-attribution test).

## Conclusion after source read

Stats DB is the ledger (`~/.omp/stats.db`, 32344 rows). Folder slug splits worktrees of one repo. `autonomous-loop.wt` and `buck-workflow-pi-pr20` share `buck-workflow-pi/.git` and `git@github.com:evilbuck/buck-workflow-pi.git` but are separate folders. Branch is not in the session header. Extend stats ingest with origin/common-dir + branch snapshot. Do not use `client_usage`. Canonical write: `research-omp-token-attribution.md`.
