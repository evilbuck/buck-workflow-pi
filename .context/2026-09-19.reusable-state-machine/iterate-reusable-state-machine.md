---
status: completed
date: 2026-09-20
updated: 2026-09-20
subject: 2026-09-19.reusable-state-machine
topics: [review, iteration]
informs: []
addresses: phase-2-buck-machine-migration.md
completed: 2026-09-20
from_review: b-review
---

# Iteration: reusable-state-machine (phase 2)

## Source
- Reviewed after: `/b-build-hard`
- Plan: `phase-2-buck-machine-migration.md`
- Spec: parent `plan-reusable-state-machine.md`

## Critical Issues

### 1. New cyclomatic complexity violations fail required complexity gate
- **File**: `extensions/buck-loop/machine.ts`
- **Problem**: `npm run guardrails:check` verdict `status: fail`, `complexity_gate: fail`. New functions over the repo ceiling: `reviewingState` complexity 25 (also `hard_ceiling_violations`), `committingState` complexity 11. Baseline hotspot count stays 37; these are **new** functions, so the ratchet cannot absorb them. b-review treats a required-gate fail as verification ❌ missing for this phase.
- **Proposed fix**: Split `reviewingState` (and `committingState` if still >10 after the split) into named helper builders so each function is ≤10 cyclomatic, without changing guards, targets, or outputs. Re-run `npm run guardrails:check` until `complexity_gate` is `pass`. Do not weaken `guardrails.json` or add inventory exceptions.

## Warnings

None.

## Recommended Workflow

Start with `/b-iterate` — it will pick up this file automatically.
Then re-run `/b-review` against `.context/2026-09-19.reusable-state-machine/phase-2-buck-machine-migration.md`.

## Resolution

Split `reviewingState` / `committingState` into named helpers (`committingChoices`, `reviewingSessionAutomatic`, `reviewingPriorityAutomatic`, `reviewingChoices`, `iterateLimitBlocked`). Guards, targets, and outputs unchanged. `npm run guardrails:check` complexity_gate pass; 89/89 focused tests pass.
