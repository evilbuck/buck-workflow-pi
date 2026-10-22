---
status: completed
date: 2026-10-16
updated: 2026-10-16
subject: 2026-10-16.buck-loop-jev-halt-diagnose
topics: [review, iteration]
informs: []
addresses: plan-diagnose-halt.md
completed: 2026-10-16
from_review: b-review
---

# Iteration: buck-loop-jev-halt-diagnose

## Source
- Reviewed after: `/b-build`
- Plan: `plan-diagnose-halt.md`
- Spec: none

## Critical Issues

### 1. File-mode saving heavy lift never enters diagnosing
- **File**: `extensions/buck-loop/machine.ts`
- **Problem**: A heavy halt while `saving` in file mode opens both `diagnosing` and `committing`. `decisionOpen` is false for a Jev halt, so `next()` throws `AMBIGUOUS_ROUTE: saving -> [diagnosing, committing]` and the supervisor blocks. SQL mode takes `diagnosing`. Building, iterating, and documenting close their successor via `confirmedOrAmbiguous` when `jevHaltOpen` is true; the saving commit guard at the `ambiguousChoiceOpen && !sqlMemoryConfigured` clause does not. The plan requires `saving` as a diagnose origin.
- **Proposed fix**: Exclude `jevHaltOpen` from the saving → committing guard, the same way `confirmedOrAmbiguous` already does. Add a machine test for file-mode and SQL-mode saving halts: file mode must emit `{ kind: "diagnose" }`, not throw.

### 2. One diagnose attempt is run-wide, not per halt
- **File**: `extensions/buck-loop/loop.ts`
- **Problem**: `rescanAsOrigin` increments `diagnoseAttempts` and nothing clears it after a landed proof. `enterDiagnose` then refuses every later heavy halt (`diagnoseAttempts >= 1`) and `stopForOperator` blocks with `heavy lift:`. The field comment says the ceiling is for this halt. A second ambiguous build, iterate, document, or save in the same run cannot diagnose.
- **Proposed fix**: Clear `diagnoseAttempts`, `repairLift`, `diagnoseOrigin`, and `diagnoseHandoff` when the landed diagnose leaves `diagnosing` for its successor. Keep the ceiling at 1 for a miss, and keep resume of that miss from rebuilding. Add a loop test where a landed diagnose is followed by a new heavy halt that still calls `diagnoseFix` once.

### 3. Diagnosing bookmark is not persisted before the child
- **File**: `extensions/buck-loop/loop.ts`
- **Problem**: `enterDiagnose` stamps `repairLift` and moves to `diagnosing` in memory, then calls `executeDiagnose` without `persistIfPossible`. `drive` persists only the pre-choice work snapshot. A crash during the child leaves a building (or other origin) bookmark with no heavy stamp. Resume re-enters ambiguity classification and can retry the skill. That violates the durable heavy-lift resume contract and the one-attempt ceiling.
- **Proposed fix**: Persist the diagnosing snapshot, including `repairLift`, `diagnoseOrigin`, `diagnoseHandoff`, and `diagnoseAttempts`, before `diagnoseFix`. Resume of that bookmark must call `diagnoseFix` and must not call `b-build`.

### 4. persist.test.ts does not cover the new bookmark
- **File**: `extensions/buck-loop/__tests__/persist.test.ts`
- **Problem**: The plan's verification names this file. `persist.ts` reads and writes `repairLift`, `diagnoseOrigin`, `diagnoseHandoff`, and `diagnoseAttempts`, and `diagnosing` is a legal state, but the test file has no assertions for those fields. A dropped attempt count would reopen a spent halt.
- **Proposed fix**: Round-trip a `diagnosing` projection and a blocked heavy-lift projection through write/read. Assert illegal origins and non-integer attempts do not revive a spent diagnose or invent a checkpoint.

## Warnings

### 1. Extension-restart block still carries a heavy stamp
- **File**: `extensions/buck-loop/loop.ts`
- **Problem**: `stopForExtensionRestart` blocks the diagnosing snapshot without clearing `repairLift` or spending `diagnoseAttempts`. Same-process resume stays blocked via the in-memory map. A fresh process, which the restart message requires, will see a heavy-lift bookmark and enter diagnosing.
- **Suggested approach**: Hold resume when the block why starts with `Restart OMP before continuing`, or clear the heavy stamp when recording that block, so the restart reason stays the resume contract.

## Recommended Workflow

Start with `/b-iterate` — it will pick up this file automatically.
Then re-run `/b-review` against the same plan.
Inside an OMP execution session, `/b-iterate` completes this artifact before it returns; the supervisor then re-reviews. Do not leave the file `active` waiting for review or save.

## Resolution and verification

- File-mode and SQL-mode saving heavy halts now open only the diagnosing edge.
- Successful departure from diagnosing clears that halt's stamp, handoff, origin, and attempt count. Misses retain the spent attempt and no-rebuild hold.
- The diagnosing bookmark is written before the child starts. Regression checks observe the on-disk state during the child and resume a persisted diagnosing state without building.
- Persistence tests cover legacy fields, live/spent diagnosis bookmarks, and invalid origins/attempt counts. Present invalid authority fields fail the projection read rather than normalize a spent attempt to zero. No checkpoint is synthesized.
- Restart warning resolved without the proposed permanent resume hold: the existing how-to requires fresh-process recovery. A restarted diagnostic operation only rescans its original proof; it neither rebuilds nor reruns the spent diagnosis. Missing proof becomes the terminal diagnose miss.
- A thrown diagnose error reaches the structured failure sink and persists in the blocker. SQL saving-origin proof uses the existing receipt verifier; a file-mode memory claim cannot satisfy it.
- Focused Vitest suites: **415 passed, 6 skipped**, 3 files, exit 0. Live SQL receipt coverage remains environment-gated; no live SQL success is claimed.
- Mutation check: restoring the saving guard, removing the per-halt reset and pre-child persistence, and dropping the persisted attempt count caused **four targeted regressions to fail**. Fixes restored before final verification.
- Durable guardrails: **pass**, exit 0. Required unit, coverage ratchet, and complexity gates pass; lint/functional skipped, patch advisory. Coverage 89.4% against baseline 84%; no new complexity violations. Baseline unchanged.
- Direct Bun smoke: eight heavy-origin routes (four origins × file/SQL mode) select diagnosing; a real temporary Git repository retains a spent bookmark without reviving diagnosis or inventing a checkpoint.

Next: `/b-review .context/2026-10-16.buck-loop-jev-halt-diagnose/plan-diagnose-halt.md`.
