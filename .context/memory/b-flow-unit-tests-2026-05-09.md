---
date: 2026-05-09
domains: [testing, debugging, orchestration]
topics: [b-flow, xstate, vitest, guard-routing, unit-tests]
subject: 2026-05-08.b-orchestration-extension
artifacts: [spec-b-flow-state-machine.md, phase-4-ui-commands-tests.md]
related: [b-flow-start-debug-2026-05-09.md]
priority: high
status: completed
---

# Session: 2026-05-09 - b-flow XState machine unit tests

## Context
- Follow-up to b-flow start/status debugging session
- User requested dedicated XState machine unit tests with vitest

## Findings

### Guard ordering bug discovered
The planning state had `hasPhasesOverview` checked *before* `hasActivePhase` in the `onDone` transition array. Since XState evaluates guards in order and takes the first match, the machine always routed to `decomposing` even when an active phase existed.

**Fix**: Reordered guards — `hasActivePhase` (more specific) now checked before `hasPhasesOverview` (less specific).

### Test infrastructure
- Added vitest as dev dependency
- Created `vite.config.ts` with test include pattern
- Added `npm run test` script to package.json

## New Test File

`extensions/b-flow/__tests__/machine.test.ts` — 31 tests covering:

| Category | Tests |
|----------|-------|
| Initial state | idle state, empty goal |
| Recovery | restores persisted projection |
| START transitions | through recovering, writes projection |
| Planning routing | → decomposing (overview only), → executingChunks (active phase), → decomposing (no artifacts), → decomposing (completed phases) |
| CONTINUE | decomposing → executingChunks → reviewing |
| PAUSE/RESUME | pause from decomposing, resume back through recovering |
| STOP | from decomposing, from paused |
| Subject inference | from active phase, from overview, preserves existing |
| Chunk queue | empty queue → reviewing |
| History | records transition history |
| Scan-level | finds overview, active phase, skips completed, finds backlog items, finds tasks.md |
| Guard routing | hasPhasesOverview, hasActivePhase |
| Persistence | writes projection after transitions |
| Machine definition | all states, id, final states, root PAUSE/STOP |

## Total Test Coverage

| Test File | Runner | Count |
|-----------|--------|-------|
| `machine.test.ts` | vitest | 31 |
| `integration.test.ts` | node:test | 9 |
| `guards.test.ts` | node:test | 6 |
| **Total** | | **46** |

## Modified Files
- `extensions/b-flow/machine.ts` — guard order fix
- `extensions/b-flow/__tests__/machine.test.ts` — new (31 tests)
- `extensions/b-flow/__tests__/integration.test.ts` — fixed for new guard order
- `package.json` — added vitest, test scripts
- `vite.config.ts` — new
