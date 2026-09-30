---
status: completed
date: 2026-09-30
updated: 2026-09-30
subject: 2026-09-30.buck-loop-save-commit-handoff
topics: [review, iteration]
informs: []
addresses: plan-save-commit-handoff.md
completed: 2026-09-30
from_review: b-review
---

# Iteration: buck-loop save/commit handoff

## Source
- Reviewed after: `/b-build`
- Plan: `plan-save-commit-handoff.md`

## Critical Issues

### 1. Parse actual phase `files:` lists and directory scopes
- **File**: `extensions/buck-loop/loop.ts:970-1002`; `extensions/buck-loop/__tests__/loop.test.ts:1351-1421`
- **Problem**: `readFrontmatter` only keeps text on the `files:` line. Real phases use YAML block sequences (`files:\n  - skills/b-build/SKILL.md`), so `declaredPhaseFiles` returns `[]` and the old guard blocks the phase's own deliverable. Even an inline `files: [skills/]` only matches an exact porcelain path, not files beneath that declared directory. Reproduced against the existing decision-closure Phase 5 file and a declared `skills/` directory: both blocked with `refuses to commit unstaged non-.context changes`. The plan's A-2 validation claim is not supported by the current parser.
- **Proposed fix**: Parse the real phase frontmatter form, distinguish declared files from declared directory prefixes on path-component boundaries, and auto-stage only matching paths. Test using a real-form phase fixture with a block `files:` list and a declared mirror directory, then assert the checkpoint proceeds while unrelated paths still block.

### 2. A rename can sweep an undeclared source into the commit
- **File**: `extensions/buck-loop/loop.ts:939-957,1004-1006`
- **Problem**: For a porcelain rename, `paths.some(declaredSet.has)` accepts the whole row when only its destination is declared. `autoStage` then adds *both* source and destination, including an unrelated source. Reproduced a staged-intent rename `outside.txt -> skills/b-build/SKILL.md` with only the latter declared: checkpoint returned `STAGED` and the cached diff was `R100 outside.txt skills/b-build/SKILL.md`. This violates the plan's no-unrelated-file safety property.
- **Proposed fix**: Require every non-`.context` path in a status row to be in phase scope before auto-staging it, or reject mixed-scope renames. Add a regression using a tracked out-of-scope source and declared destination; assert refusal and no added rename in the index.

### 3. Recoverable SQL failures still latch model-retry suppression
- **File**: `extensions/buck-loop/run-step.ts:414-417,451,517-520`; `extensions/sql-memory/index.ts:28-36,194-196`
- **Problem**: `workSqlFailed` stays true after every failed SQL call, including a corrected intermediate call, and ignores the new callback's failure info. Successful agent text bypasses that flag, but if the same session subsequently fails for an unrelated model/host reason, `blockRetry` remains true and suppresses the ordinary model fallback. The plan explicitly limits blocking to genuine final-op failure.
- **Proposed fix**: Track whether a blocking SQL operation remains unresolved by the session's final verified state (rather than any prior callback); retain retry suppression for a genuine unresolved final failure. Add a corrected-op-then-host-failure regression alongside the final-failure case.

### 4. Save regression cases do not exercise receipt authority or final failure
- **File**: `extensions/buck-loop/__tests__/run-step.test.ts:92-205`; `extensions/buck-loop/__tests__/loop.test.ts`
- **Problem**: The teardown test runs `b-build`, not `b-save`, and asserts success without writing/verifying a receipt; the mid-session test performs a denied DELETE but no corrected final insert. There is no focused test of final insert failure preserving `blockRetry`/blocking. These do not establish the plan's required save-stage transitions.
- **Proposed fix**: Add deterministic save-stage tests with a matching valid receipt plus failing pool teardown and an intermediate failed op followed by a successful insert/read-back; add a missing/failed-final-insert case asserting the supervisor blocks (and no model retry) rather than reports success. Assert teardown activity emission rather than merely checking the callback's type.

## Warnings

### 1. Remove ineffective cleanup state and test scaffolding
- **File**: `extensions/buck-loop/run-step.ts:493-521`; `extensions/buck-loop/__tests__/run-step.test.ts:171-175`
- **Problem**: `retain: outcome.ok` short-circuits `blockRetry` for every success, so `(completedWork && cleanupFailed)` is ineffective; the test repeats the same success assertion and checks `typeof onActivity` instead of warning emission. Standards-axis issue, secondary to the behavioral gaps.
- **Suggested approach**: Keep the minimal failure-path flags; assert observable warning and save outcome.

## Recommended Workflow

After `/b-iterate`, re-run `/b-review` against the same plan. The bundled-copy parity failure observed during the original review is no longer present in the latest durable guardrails run; do not weaken the contract.

## Resolution
- Parsed YAML block/inline `files:` declarations, with component-boundary directory matching; actual Phase 5 metadata stages its declared skill file. Mixed-scope renames refuse before staging.
- Save-stage SQL work failures clear after a successful correction, while an unresolved final failure suppresses model fallback. Teardown failures emit activity without converting a completed save into a failed outcome.
- Receipt-backed save, corrected insert/read-back, unresolved final insert, directory scope, and rename regressions pass; removed the ineffective cleanup flag and assertion.
- Verification: focused Vitest 112 passed/5 skipped; full Vitest 1230 passed/6 skipped; `npm run guardrails:check` passed (unit, coverage ratchet, complexity; lint/functional disabled, patch advisory). Direct checkpoint smoke staged an existing real-form Phase 5 file and its declared skill file.
- Awaiting independent `/b-review` before `/b-save` and `/b-commit`.
