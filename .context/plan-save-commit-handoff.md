---
status: active
date: 2026-09-30
subject: 2026-09-30.buck-loop-save-commit-handoff
topics: [buck-loop, b-save, commit-checkpoint, sql-memory, error-classification]
research:
  - research-save-commit-handoff.md
iterations: []
spec: null
memory: []
---

# Plan: Stop buck-loop save/commit checkpoints from failing completed work

## User Goal

Operators running `/buck-loop` no longer have to hand-finish every phase: a save whose durable work succeeded must not be reported as failed, and a commit checkpoint must land the phase's own work instead of blocking on it.

## Goal

Fix the two verified failure modes that forced manual intervention during the decision-closure run (Phases 3–6, every cycle):

1. **Save success reported as failure.** `runNestedWork` in `extensions/buck-loop/run-step.ts` latches a single `sqlFailed` flag from any source — including `pool.end()` teardown errors (`run-step.ts:500-505`) and any prior `onFailure` callback fire — and then overrides an otherwise-successful child outcome with `SqlMemoryError` (`run-step.ts:466-468`). Observed repeatedly: the child wrote its receipt with `completed: true`, logged `agent finished`, and the supervisor still recorded `SqlMemoryError`, burning the loop's one retry.
2. **Commit checkpoint blocks on the phase's own work.** `prepareCommitCheckpoint` (`extensions/buck-loop/loop.ts:927-938`) throws when any non-`.context` path is unstaged. The b-build child legitimately produces `skills/**`, `plugins/**`, `docs/**` edits for the phase; when the child (or a later review step) leaves any of them unstaged, the guard fires and the loop goes `blocked`, requiring an external manual commit every phase.

## Evidence

- `sql-memory-receipts/*` files written `completed: true` immediately before each `SqlMemoryError` (Phases 3, 4, 5 save attempts).
- Loop history entries: `saving → saving "saving session failed; retrying once"` and `committing → blocked "refuses to commit unstaged non-.context changes: M skills/b-build/SKILL.md …"` — the named files were exactly the phase's deliverables, committed manually as `c44b383`, `bb7ecec`, `80fbb2c`, `f30ba7e`.
- Code: `run-step.ts:414` (`let sqlFailed`), `:445` (latching callback), `:466` (outcome override), `:500-505` (teardown sets the same flag); `loop.ts:927-938` (commit guard); `machine.ts` `saving-confirmed-commit` / `committing-*` transitions.

## Scope

### In scope

- Split the save-failure signal in `run-step.ts`: teardown/cleanup failures (`poolEndError`, unsubscribe/dispose errors) must not override a successful outcome whose SQL save receipt verifies; distinguish "work failed" from "teardown failed". The receipt (`verifySqlSave`) already exists as ground truth — use it.
- Stop latching `sqlFailed` across an entire session for recoverable per-call failures: only a failed *final* insert/read-back (the directive's blocking conditions) should fail the save stage. A failed recall probe or a corrected intermediate op must not.
- Change `prepareCommitCheckpoint` from throw-on-any-unstaged to: auto-stage the active phase's declared `files:` list (and skills/plugins/docs mirrors when the phase declared them) before the guard runs; throw only for unstaged paths outside the phase's declared scope (unchanged safety for genuinely unrelated work).
- Keep both safety properties: no sweeping of unstaged unrelated files into a phase commit; `blockRetry` still set for real SQL work failures.
- Focused tests for: teardown-failure-with-valid-receipt; per-call failure then corrected final state; commit guard with phase-scope unstaged files (auto-staged, commit proceeds); commit guard with out-of-scope unstaged file (still blocks).

### Out of scope

- The b-save skill's 12 responsibilities and directive wording beyond what staging requires.
- SQL schema/receipt format changes (`sql-save.ts` contract stays).
- State machine topology (`machine.ts` transitions stay; only the inputs they consume get more accurate).
- The larger typed-review/fix-or-continue roadmap.

## Affected files

| Path | Planned change |
|---|---|
| `extensions/buck-loop/run-step.ts` | Separate work-failure from teardown-failure; stop overriding verified saves. |
| `extensions/sql-memory/index.ts` | `onFailure` carries which op failed (or only fires for blocking ops) so run-step can classify. |
| `extensions/buck-loop/loop.ts` | `prepareCommitCheckpoint` gains phase-scope auto-staging before the guard. |
| `extensions/buck-loop/__tests__/run-step.test.ts`, `loop.test.ts` | New failure-classification and staging-guard cases. |
| `plugins/buck-workflow/skills/b-save/SKILL.md` | Only if directive wording must match the narrowed staging rule (byte-parity with canonical). |

## Implementation steps

1. In `run-step.ts`, split `sqlFailed` into `workSqlFailed` (set only by the `sqlMemoryTool` callback when the failing op is a directive-blocking insert/read-back/correct) and `teardownSqlFailed` (set only in the `pool.end()`/cleanup path). Compute `blockRetry` from `workSqlFailed`; let `teardownSqlFailed` log via `recordCleanupError` without changing the outcome when the child otherwise succeeded and the receipt verifies.
2. Pass the failed-op kind through `sqlMemoryTool`'s `onFailure` (extend the callback signature in `extensions/sql-memory/index.ts`) so run-step can classify without guessing.
3. In `loop.ts`, make `prepareCommitCheckpoint` accept the active phase path: read the phase file's `files:` frontmatter, `git add` those paths (plus `.context` as today), then run the existing unstaged guard. Files outside the declared scope still block with the same error shape.
4. Thread the phase path into the commit call site (`loop.ts:730`) — it already has `planOrPhasePath`.
5. Tests: (a) pool.end throws + receipt verifies → save ok, activity logs teardown warning; (b) sql op fails mid-session, agent recovers with a corrected final insert → save ok; (c) final insert fails → `SqlMemoryError` and `blockRetry` unchanged; (d) commit with phase-declared unstaged `skills/b-build/SKILL.md` → staged automatically, commit proceeds; (e) commit with an unstaged out-of-scope file → same refusal as today.
6. Run focused suites (`run-step`, `loop`, `sql-save`) and `npm run guardrails:check`; sync the b-save plugin copy only if step 3's behavior changed its directive.

## Acceptance criteria

- [ ] A save session whose only failure is pool teardown completes `ok`, with `verifySqlSave` as the authority; no `SqlMemoryError` surfaced to the supervisor.
- [ ] A mid-session recoverable SQL failure does not latch the save-failure flag; only a failed final blocking op does.
- [ ] A commit checkpoint auto-stages paths declared in the active phase's `files:` frontmatter and proceeds.
- [ ] A commit checkpoint still refuses unstaged paths outside the phase's declared scope, with the current error message shape.
- [ ] `blockRetry` remains true for genuine final-op SQL failures (no silent downgrade).
- [ ] Focused buck-loop suites and `npm run guardrails:check` pass; new behavior covered by deterministic tests.

## Verification

- `bun test extensions/buck-loop/__tests__/run-step.test.ts extensions/buck-loop/__tests__/loop.test.ts` (focused; new cases above).
- `npm run guardrails:check` (code-touching session — blocking).
- Live smoke: run `/buck-loop` on a subject with one small phased plan and confirm save → commit advances without operator staging.
- Replay classification: simulate `poolEndError` in a test double and assert the receipt-verified save reports success.

## Risks

| Failure mode | Impact | Mitigation | Rollback / fallback |
|---|---|---|---|
| Auto-staging sweeps a file the operator was editing into the phase commit. | Unrelated work committed under a phase subject. | Stage only the phase's declared `files:` list; out-of-scope files keep blocking; the refusal message names them. | Revert to throw-on-any-unstaged guard (single-function revert). |
| Teardown failure masks a real partial write. | Save reported ok but a durable write is missing. | Receipt verification (`verifySqlSave`) remains the authority; a missing/failed receipt still blocks. | Keep `blockRetry` on any SQL-work failure flag. |
| `onFailure` signature change breaks other sql-memory callers. | Compile error or silent no-op. | LSP references before changing; update all call sites; type tests. | Keep boolean callback as an overload. |

## Assumptions ledger

| ID | Assumption | Status | Blocking | Validation path |
|---|---|---|---|---|
| A-1 | Every observed `SqlMemoryError` during Phases 3–5 was teardown- or recovery-class, not a final-op failure (receipts all landed `completed: true`). | validated | false | Receipt files on disk + loop log cross-reference in this subject's research file. |
| A-2 | Phase files' `files:` frontmatter is trustworthy enough to define the commit scope. | validated | false | It already drives `listPhases`/phase targeting; wrong scope degrades to today's guard behavior. |

## Recommended next step

Single-session plan; no phasing needed. Run `/b-build` on this plan, then `/b-review → /b-save → /b-commit`.
