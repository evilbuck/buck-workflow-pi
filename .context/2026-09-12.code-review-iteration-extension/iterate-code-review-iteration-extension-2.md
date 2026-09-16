---
status: active
date: 2026-09-16
updated: 2026-09-16
subject: 2026-09-12.code-review-iteration-extension
topics: [review, iteration, check-contract, patch-coverage]
informs: []
addresses: brainstorm-code-review-iteration-extension.md
completed: null
from_review: b-review
---

# Iteration: code-review-iteration-extension (review 2)

## Source
- Reviewed after: `/b-iterate` (2026-09-16 working tree on `feat/code-reviewer-extension`, uncommitted delta on `b63e2d4`)
- Plan: `brainstorm-code-review-iteration-extension.md`
- Prior iterate: `iterate-code-review-iteration-extension.md` (C1–C2 + W1–W8 claimed complete)

## Critical Issues

### 1. Live fixer checks never run this repo's guardrails contract (fail-open)
- **File**: `extensions/code-review-iteration/index.ts:149-157` (`readCheckContractCommands`), `index.ts:301-307` (`runChecks`)
- **Problem**: `readCheckContractCommands` reads `ecosystems[].test_cmd`. Durable v2 `guardrails.json` stores `test_runner` (`"vitest run"` here). The map yields `["","",""]`, `filter(Boolean)` yields `[]`, and `?? ["npm test"]` does not fire on an empty array. `runChecks` then returns `{ command: "(no runnable check command)", exitCode: null, passed: true }`. A Fixer pass checkpoints as if verification succeeded. Loop tests mock `runChecks`, so they cannot catch this. The iterate explicitly allowed pass-on-absent-contract; this repo *has* a contract that the reader cannot see.
- **Proposed fix**: Read `test_runner` (and `functional_test_cmd` when non-null). Keep the no-file fallback (`npm test`). Empty-after-filter should still mean "no runnable command"; decide fail-closed vs fail-open explicitly once the field name is correct — on a repo with a real `test_runner`, the command must run. Add a test that points `cwd` at a fixture `guardrails.json` with `test_runner: "vitest run"` and asserts `runChecks` (or `readCheckContractCommands`) returns that string, not the empty/pass-open path.

## Warnings

### 1. Patch coverage still 89% < 90% (W6 incomplete)
- **File**: repo-level `origin/master` patch vs working tree (`diff-cover coverage/lcov.info --compare-branch=origin/master`)
- **Problem**: 1234 changed lines, 124 missing, 89% (threshold 90). Dominant hole: `index.ts` 61.6% (`makeDeps` / `runChecks` / `selectUntracked` / `readCheckContractCommands` 152-156, 213-255, 270-325). Secondary: `loop.ts` error paths 157-158, 163-164, 197-198, 202-203, 212-214. Iterate claimed 91.97%; current measurement is 89%. Extension CCN split of `validateReproduction` / `runReviewerPass` did land (lizard CCN 8 and 4).
- **Suggested approach**: Tests for Critical 1 will cover the `index.ts` hole that also drives the patch miss. Add loop tests for fetch-fail / rebase-fail / rebase-abort notify paths if still short. Do not re-baseline.

### 2. `--autostash` remains after checkpoint-first (Found B residual)
- **File**: `extensions/code-review-iteration/git-ops.ts:114` (`rebaseOntoFetched`)
- **Problem**: `prepareBaseAndCheckpoint` now checkpoints before fetch/rebase so the rebase should be clean. `rebaseOntoFetched` still passes `--autostash`. If `checkpointCommit` returns null on a still-dirty tree (untracked-only, user excluded everything), autostash can recreate the UU-on-continue failure the new comment says is gone.
- **Suggested approach**: Rebase without `--autostash` now that the loop owns dirty-state itself; or, if autostash stays as a belt-and-suspenders, add a test for dirty-untracked-excluded + rebase-conflict so the UU path cannot silently return.

### 3. Byte cap can still exceed `max_output_bytes` on a mid-codepoint slice
- **File**: `extensions/code-review-iteration/policy.ts:257-265` (`attachCappedStream`)
- **Problem**: `buf.subarray(0, room).toString()` on a UTF-8 boundary emits U+FFFD (3 bytes). `Buffer.byteLength(excerpt)` can then exceed `maxBytes`. The new test uses even-aligned `é` chunks and does not catch this.
- **Suggested approach**: Truncate on a codepoint boundary (or keep raw bytes for the excerpt and decode only a valid prefix).

## Recommended Workflow

Start with `/b-iterate` — it will pick up this file automatically.
Then re-run `/b-review` against the same subject.
Critical 1 first: the live check contract is a false-green gate, same class as the C1 payload bug just fixed.
