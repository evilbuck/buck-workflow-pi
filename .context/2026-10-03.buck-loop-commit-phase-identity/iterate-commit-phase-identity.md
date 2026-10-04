---
status: completed
date: 2026-10-04
updated: 2026-10-04
subject: 2026-10-03.buck-loop-commit-phase-identity
topics: [review, iteration, commit-checkpoint]
informs: []
addresses: plan-commit-phase-identity.md
completed: 2026-10-04
from_review: b-review
---

# Iteration: Commit phase identity

## Source

- Reviewed after `/b-iterate` against `plan-commit-phase-identity.md`.
- Implementation checkout: `/tmp/buck-loop-commit-phase-identity`, branch `fix/buck-loop-commit-phase-identity`, baseline `b184c34`.
- Report: `review-commit-phase-identity-2026-10-04.md`.
- Edit that checkout only. The assignment checkout does not contain the cutover.
- Prior critical issues from the 2026-10-03 review (projection drift, illegal committing confirmation, second commit child, weak object-id parsing, phase-completion shortcut, blocked-status wording, missing public matrix, complexity ceiling) were re-checked and are closed. Do not reopen them.

## Critical Issues

### 1. Stopped checkpoint status is not a legal continuation

- **File**: `extensions/buck-loop/loop.ts` `stoppedStatus` / `recoveryFor`; `docs/howto/recover-buck-loop.md` step 3.
- **Problem**: Direct stop from `committing` returns `Run stopped. To continue, run /buck-loop <phase>` and does not name the retained checkpoint. On branch `loop-work`, following that start cleared `commitCheckpoint` and moved `phasePath` to pending Phase 2 while Phase 1 was still uncommitted. Stop from a blocked marker names the checkpoint but says `Run /buck-loop --resume`; resume of `aborted` returns `aborted` and repeats that advice.
- **Proposed fix**: If a validated checkpoint is still present, status must name its target and baseline and must not recommend a fresh start or a no-op resume. Say that an aborted run will not continue the checkpoint: complete that retained commit manually, then explicitly start the next phase. Add a public real-Git regression for both stop shapes. Align the how-to so a stopped retained checkpoint is not restarted through the shown phase path.

### 2. Required gates fail on this base

- **File**: `extensions/buck-loop/__tests__/sql-save.test.ts:91` (unchanged). Repair diff does not include `sql-save.ts`.
- **Problem**: `npm run guardrails:check` failed required `unit_test_gate` and `global_ratchet`. The only unit failure expects `subject:` in `saveDirective`. Coverage was not measured because that command exited 1. Complexity passed with no new or hard-ceiling violations. Lint and functional are disabled. Patch is advisory.
- **Proposed fix**: Rebase the repair onto a base where this pre-existing assertion already passes. Assignment HEAD `cca1691` includes `subject:` in `saveDirective`; use that only as base evidence. Do not edit the SQL save directive, receipt protocol, or this test inside the identity commit. Re-run focused suites and `npm run guardrails:check` after the rebase. Do not weaken the contract.

## Warnings

### 1. Status integration test is outside the declared file list

- **File**: `extensions/buck-loop/__tests__/wire-status.integration.test.ts`
- **Problem**: The plan requires an exact extra test file to be added to `files:` before checkpoint. This file changed and was not added.
- **Suggested approach**: Add that exact path to the plan `files:` list. Do not widen the scope to a directory prefix.

## Resolution

- Rebased `/tmp/buck-loop-commit-phase-identity` onto assignment base `cca16919ba653416ce0bbc45a87165f7efcf3881`, retaining the identity cutover. The sole autostash conflict combined the upstream `productionClassifyRepair` import with the repair's `LoopDeps` type import. No SQL-save source/test change was added to the repair. Autostash `56a19ad` remains as a recovery backup.
- Stopped checkpoint guidance now names the original target and baseline and states that an aborted run cannot continue it. Resolve/verify the retained commit manually before explicitly starting the next phase. Direct committing stops and blocked checkpoint stops both retain their marker; resume remains aborted and starts no worker.
- Added both public real-Git stop regressions and aligned the recovery how-to/changelog.
- The assignment plan already declares `extensions/buck-loop/__tests__/wire-status.integration.test.ts` exactly in `files:`; no scope widening was needed.
- Fresh focused suites: 384 passed / 5 SQL-dependent skips. `npm test`: 1593 Vitest passed / 8 skipped, plus 70 Bun passed. Durable guardrails: pass, coverage 89.2% against baseline 84%, no new/hard-ceiling complexity violations; lint/functional disabled.
- Fresh-process public-supervisor smoke covered both stop shapes, status/resume without workers, manual checkpoint commit, then explicit Phase 2 start. Each fixture ended done with exactly two commits since baseline. Fixture repositories and smoke script were removed.
- Current evidence and staging scope: `research-stop-checkpoint-iteration.md`. Re-review remains the supervisor's responsibility; no save, commit, production resume, or supervisor-state selection was performed.

## Recommended Workflow

Start with `/b-iterate` in `/tmp/buck-loop-commit-phase-identity`. Then re-run `/b-review` against `plan-commit-phase-identity.md`. Do not leave this file `active` waiting for save. Preserve the incident checkout and the original blocked production run. This review does not select a supervisor state.
