---
date: 2026-08-26
domains: [extensions, omp, models]
topics: [omp-models, modelRoles, createAgentSession, getModel, b-save-improved, b-commit-improved, b-pr-improved, b-flow]
related: [b-save-improved-2026-08-26.md]
priority: high
status: completed
---

# OMP catalog for nested createAgentSession()

Nested extension sessions were calling Pi `getModel()` / `~/.pi/agent/settings.json`. OMP's catalog lives in `~/.omp/agent/config.yml` `modelRoles` (project `.omp/config.yml` first). Pi's list misses OMP-only providers (`zai-glm`).

## Decision

Shared helper `extensions/omp-models.ts`:
- `agentDir` = `~/.omp/agent` (overridable via `OMP_AGENT_DIR`)
- `modelPattern` from `modelRoles`
- difficulty: easy→smol, medium→slow, hard→default

Consumers: `b-save-improved`, `b-commit-improved`, `b-pr-improved`, `b-flow/sdk-worker`, `extensions/index.ts` auto-switch. Auto-switch no longer writes `~/.pi/agent/settings.json`.

## Verify

`npx vitest run` on omp-models + save/commit/pr + buck-mode + b-flow sdk-worker/integration: 99 passed (then handler assertion added, 29 re-passed).

Restart OMP to load the new helper.
