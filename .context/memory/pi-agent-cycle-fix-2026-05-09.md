---
date: 2026-05-09
domains: [debugging, infra, agent]
topics: [model-cycling, hung-requests, pi-coding-agent, abort-controller]
subject: 2026-05-09.pi-agent-cycle-fix
artifacts: [plan-abort-on-cycle.md]
related: []
priority: high
status: active
---

# Session: 2026-05-09 — pi-coding-agent Model Cycling Fix

## Context

User reported sessions getting stuck in "working..." spinner indefinitely. Initial hypothesis was a bug in `extensions/index.ts` model switching logic, but deeper analysis revealed the root cause is in the pi-coding-agent core.

## Root Cause Found

**File:** `packages/coding-agent/src/core/agent-session.ts`

`cycleModel()` (line 1439) delegates to `_cycleScopedModel()` and `_cycleAvailableModel()`. Both set `this.agent.state.model = next.model` **without calling `abort()` first**.

**Result:** In-flight HTTP requests are never cancelled when user cycles models. Rapidly cycling through 7 models leaves 7 concurrent hung requests.

**Evidence from user logs:**
- Last successful response at 00:44:50
- 7 model_change events at 01:03:23-28 (rapid cycling)
- All subsequent messages ignored until user cycles back to a working model

`abort()` exists (line 1387) and correctly calls `this.agent.abort() + await this.agent.waitForIdle()`, but `cycleModel()` never calls it.

## Fix Planned

Add `await this.abort()` as first step in both `_cycleScopedModel()` and `_cycleAvailableModel()` before mutating model state.

## Files Analyzed

- `extensions/index.ts` — NOT the cause; model switching logic there is sound
- `packages/coding-agent/src/core/agent-session.ts` — **root cause**
- `packages/coding-agent/src/core/agent-session.d.ts` — TypeScript interface
- Source repo: `https://github.com/earendil-works/pi-mono` (packages/coding-agent)

## Next Steps

- [ ] Submit PR to earendil-works/pi-mono with cycleModel abort fix (`plan-abort-on-cycle.md`)
- [ ] Fix extension model switch guard (`plan-extension-model-switch-guard.md`) — timestamp-based approach
- [ ] Write test for cycleModel abort behavior
