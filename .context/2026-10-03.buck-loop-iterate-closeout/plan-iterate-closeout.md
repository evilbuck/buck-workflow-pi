---
status: active
date: 2026-10-03
subject: 2026-10-03.buck-loop-iterate-closeout
topics: [buck-loop, iterating, postcondition, heavy-lift]
research: []
iterations: []
spec: null
memory: []
difficulty: hard
buck_hint: /b-build-hard
files:
  - extensions/buck-loop/ambiguity.ts
  - extensions/buck-loop/loop.ts
  - extensions/buck-loop/scan.ts
  - extensions/buck-loop/__tests__/ambiguity.test.ts
  - extensions/buck-loop/__tests__/loop.test.ts
  - extensions/buck-loop/__tests__/scan.test.ts
  - skills/b-iterate/SKILL.md
  - skills/b-review/SKILL.md
  - plugins/buck-workflow/skills/b-iterate/SKILL.md
  - plugins/buck-workflow/skills/b-review/SKILL.md
  - docs/buck-workflow.md
---

# Plan: Close one finished iterate artifact before a heavy-lift handoff

## User Goal

An operator running `/buck-loop` is not stopped by a heavy-lift handoff when the iterate session finished and the only miss is one `iterate-*.md` left `active`.

## Goal

After an ok iterating session, if exactly one unfinished iterate artifact remains, the supervisor marks it completed and advances to review without asking Jev. Every other ambiguous miss is diagnosed from the artifact the scanner actually required. A phase or plan that is already `completed` is never reported as `not completed`.

## Context used / assumptions

- User-provided context: two blocked runs on 2026-10-03, both `iterating → blocked` after `sessionOutcome=ok`, `retriesUsed=0`, `postcondition=ambiguous`, with Jev classifying the repair heavy.
- Session context: the ranking run's phase file was already `status: completed` with every acceptance box checked. The commit-phase-identity run is unphased, `phasePath` null, plan `status: active`, and all ten boxes open. Both iterate artifacts were still `status: active` / `completed: null`. The children left them active on purpose, citing supervisor re-review or out-of-scope gates.
- Code: `POSTCONDITION.iterating` confirms only when `hasIterate()` is false (`extensions/buck-loop/scan.ts`). On this baseline `hasIterate()` ignores only `completed`; the incident worktree also ignores `below-waterline`, so the shared predicate lands here too. `resolveAmbiguity()` (`extensions/buck-loop/loop.ts`) may rewrite a fully checked phase via `repairCheckedPhase()`, then asks Jev. `explainAmbiguity()` always appends `, not completed`, even when the inspected file is already completed.
- Skill clash: `skills/b-iterate/SKILL.md` says an active artifact stays blocking until review passes, and also says completion must set `status: completed` before yield. `skills/b-review/SKILL.md` tells an execution session the artifact is not done until review and save. Children followed the stay-active sentence.
- Docs: `docs/buck-workflow.md` says every ambiguity that is not a fully checked phase goes to Jev, and the operator message includes phase status.
- Recalled decision `01a1025d-c2a2-74cf-baa8-f6f4f9a1e853` (2026-10-03, `feat/review-severity-ranking`): an active `iterate-*.md` forces iterating; below-waterline findings must not remain in an active iterate file. This plan keeps that force. It does not change the waterline.
- Recalled recovery note `01a0fce8-dfed-7605-8a1e-15570c9b2469` is a different save-receipt defect. Do not fold it in.
- Buck capability: full. Probe source: system available-skills catalog. Sentinels `b-build`, `b-review`, and `b-save` resolved. This plan is not phased: the close and the diagnosis are one cutover.
- OMP execution recommendation: none. The path `skills/b-review/SKILL.md` contains the word review, but this is not a cross-cutting audit and must not fan out as `workflow`.

## Decision Closure

**Selected course:** reuse the existing `repairCheckedPhase()` pattern. Before `classifyRepair()`, an ok iterating snapshot with exactly one unfinished iterate file is closed by the supervisor and rescanned. Jev is not called. Zero unfinished files already confirm. Two or more are not closed; the diagnosis names those files and their statuses. `explainAmbiguity()` stops claiming `not completed` when status is already completed. Building, saving, committing, and reviewing postconditions stay as they are.

**Evidence:** both incident projections, both iterate files, `scan.ts` `POSTCONDITION.iterating`, `loop.ts` `resolveAmbiguity()`, and `ambiguity.ts` `explainAmbiguity()`. The ranking phase was done; the unphased plan was not. The shared miss was the active iterate file.

**Excluded scope:** ranking waterline, commit-phase identity, SQL save-directive subject omission, hand-editing either blocked projection, and changing `hasIterate()` so an active file no longer forces iterating.

**Next bounded action:** implement the close and the diagnosis together in a clean worktree, then prove both incident shapes with `handleLoop` fixtures.

## Assumptions Ledger

| id | statement | status | blocking | evidence / validation_path |
|---|---|---|---|---|
| A-1 | Both stops were caused by one unfinished iterate file, not by a missing phase completion. | validated | false | Ranking phase is `completed` with all boxes checked. Commit-phase-identity has no phase path. Both iterate files are `status: active`. |
| A-2 | Closing that file and entering review does not hide unfinished in-plan work. | validated | false | Review remains the next state. An active iterate file written by that review still forces iterating. Prove with a `handleLoop` fixture that the next effect after the close is review, and that a newly written active iterate file routes back to iterating. |
| A-3 | `repairCheckedPhase()` cannot clear an iterating miss. | validated | false | It rewrites phase or plan status only when every box is checked, and it returns false when status is already completed or any box is open. The iterating predicate ignores that status. |
| A-4 | A process already running `/buck-loop` keeps the old supervisor until OMP restarts. | validated | false | `stopForExtensionRestart()` and `docs/howto/resume-buck-loop-after-repair.md`. This plan does not resume either live run. |

## Material Risks

| failure_mode | impact | mitigation | rollback_or_fallback | validation_path |
|---|---|---|---|---|
| Supervisor closes an iterate file the child did not finish | The loop reviews incomplete work and may save it | Close only after `sessionOutcome=ok` and only when exactly one unfinished file exists. Do not skip review. | Revert the close helper. A later review can write a new iterate file; the operator can set that file back to `active` and resume. | `handleLoop` fixture: close does not run on a failed iterate session; the following state is reviewing, not saving. |
| Two unfinished iterate files are both closed | A second unaddressed finding disappears | Count with the same predicate as `hasIterate()`. Count other than 1 returns false and closes nothing. | Leave both files active and block with their paths in the diagnosis. | Unit fixture with two `status: active` iterate files asserts neither file changes and `classifyRepair` can still run. |
| Diagnosis still blames a completed phase | Jev repeats the false heavy lift | Iterating diagnosis names the iterate file. `explainAmbiguity()` emits `not completed` only when status is not completed. | Operator reads the iterate file status directly. The building pending-phase heavy-lift test remains the regression for the old wording. | `ambiguity.test.ts` covers `status: completed` and an active iterate file. Existing loop test still expects `phase status is pending, not completed`. |
| Fix lands in the dirty ranking worktree | Ranking and this supervisor repair share one commit | Implement from a clean branch. Carry only this subject folder. Do not adopt `feat/review-severity-ranking` index entries. | Reset the mixed commit and reapply on the clean branch. | `git diff --name-only` against the clean base contains this plan's `files:` and this subject folder, not `ranking.ts`. |

## Scope

- One shared unfinished-iterate predicate (`iterate-*.md` whose status is neither `completed` nor `below-waterline`) used by the scanner, the close target, and the diagnosis. This is the minimal scanner compatibility the plan previously mis-stated; it is not adoption of the ranking branch.
- Supervisor close of exactly one unfinished `iterate-*.md` after an **ok** iterate session, applied on the successful-iterate result path before `next()`, so a used retry or an exhausted limit cannot bypass it. Retry counters, `loopCount`, and the iterate ceiling keep their current behavior; a close never routes straight to `saving`.
- Rescan with `sessionOutcome: "ok"` and `retriesUsed: 0`, matching `repairCheckedPhase()`.
- A bounded frontmatter rewrite: the target must have editable, well-formed `active` frontmatter; the body is preserved; `status`/`completed`/`updated` are the only fields written; the write is verified to change the status, and an ineffective or failed write fails closed and closes nothing.
- State-aware diagnosis for an iterating miss that is not closed.
- `explainAmbiguity()` no longer appends `, not completed` when the inspected status is already `completed`.
- `b-iterate` and the `b-review` iterate template stop telling the child to leave the artifact active until review or save, in both the canonical skills and their byte-identical plugin copies. Completing the artifact never waives a required quality gate.
- One sentence in `docs/buck-workflow.md` for the new mechanical close.

## Out of scope

- Do not change `POSTCONDITION` for building, documenting, saving, committing, or reviewing.
- Do not treat below-waterline iterate files as unfinished, and do not write `below-waterline` from this repair.
- Do not ask Jev whether to close the single file.
- Do not hand-edit `.context/workflow/buck-loop.json` in this worktree or in `/home/buckleyrobinson/projects/development_tools/buck-workflow-pi`.
- Do not implement review-severity ranking or commit-phase identity.
- Do not change `saveDirective()`, SQL receipts, or the two failing SQL tests reported by the commit-phase-identity child.
- Do not phase this plan. Splitting the close from the diagnosis leaves the false heavy lift in place.

## Affected files

| Path | Change |
|---|---|
| `extensions/buck-loop/ambiguity.ts` | Export the shared unfinished-iterate discovery. Add the bounded single-file close. Fix `explainAmbiguity()`. Add an iterating diagnosis that names unfinished iterate files. |
| `extensions/buck-loop/scan.ts` | `hasIterate()` uses the shared predicate, so a `below-waterline` artifact no longer forces ambiguity. |
| `extensions/buck-loop/loop.ts` | Call the close on the successful-iterate result path before routing, and in `resolveAmbiguity()` before `repairCheckedPhase()`/`classifyRepair()`. Pass the iterate-file diagnosis into any remaining lift. |
| `extensions/buck-loop/__tests__/ambiguity.test.ts` | Close helper coverage (one file, two files, below-waterline, malformed, write failure) and completed-status wording. |
| `extensions/buck-loop/__tests__/scan.test.ts` | A `below-waterline` artifact confirms the iterating postcondition. |
| `extensions/buck-loop/__tests__/loop.test.ts` | Public `handleLoop` coverage for both incident shapes, two files, a failed session, and ok-after-retry with limits preserved. Keep the existing pending-phase heavy-lift assertion. |
| `skills/b-iterate/SKILL.md` | Completion closes the artifact before yield. Review is the next supervisor step, not a reason to leave `status: active`. |
| `skills/b-review/SKILL.md` | Template no longer says the artifact stays open until review and save. |
| `plugins/buck-workflow/skills/b-{iterate,review}/SKILL.md` | Byte-identical copies of the two edited skills. |
| `docs/buck-workflow.md` | Document the one-file iterate close next to the checked-phase close. |

## Implementation steps

1. Export `unfinishedIterates(subjectDir)` from `ambiguity.ts`: the `iterate-*.md` paths whose parsed status is neither `completed` nor `below-waterline`, sorted. A missing or unreadable file still counts unfinished, matching `scan.ts`. Point `scan.ts` `hasIterate()` at it so scanner, close target, and diagnosis share one rule.
2. Add `closeSingleUnfinishedIterate(subjectDir, at)` beside `repairCheckedPhase()`. It uses `unfinishedIterates()`; it returns false unless the count is exactly one. The target must have a well-formed frontmatter block and an `active` status; otherwise it returns false and writes nothing. Rewrite only the `status`, `completed`, and `updated` lines inside the frontmatter span, preserve everything else byte-for-byte, then re-read the file and require the parsed status to be `completed` before returning true. A write that throws or fails to change the status returns false. Do not check acceptance boxes; do not add a second frontmatter parser — reuse the existing `frontmatter()`/span conventions in the file.
3. Close on the successful-iterate path: in `executeSkill()`, after the rescan and only when `skill === "iterate" && result.ok`, call the helper for the subject folder. On true, rescan again with `{ sessionOutcome: "ok", retriesUsed: 0 }` so the next `next()` sees a confirmed postcondition, then return. Keep `retriesUsed` computed by `nextRetries()` untouched, and do not change `loopCount` or `iterateCyclesOnPhase`.
4. In `resolveAmbiguity()`, when `snapshot.state === "iterating"` and `sessionOutcome === "ok"`, call the helper before `repairCheckedPhase()`; on true, rescan with `{ sessionOutcome: "ok", retriesUsed: 0 }` and return without calling `classifyRepair()`. This covers a resumed or projected run that reaches ambiguity without passing through `executeSkill()`.
5. When the helper returns false in either place, build the lift diagnosis from the unfinished iterate files and their statuses, not only the phase or plan status. `explainAmbiguity()` may still report unchecked phase boxes for a building miss, but when the inspected status is already `completed` it must not say `not completed`.
6. Replace the stay-active sentence in `skills/b-iterate/SKILL.md` and its closeout line that forbids yielding before review and save; keep the completion rules and state that an artifact left `active` after an ok iterate session is a failed iterating postcondition. Required gates still apply. In `skills/b-review/SKILL.md`, change the execution-session sentence so `b-iterate` completes the artifact before the supervisor re-reviews. Copy both files byte-identically into `plugins/buck-workflow/skills/`.
7. Add the mechanical-close sentence to the ambiguous-postcondition bullet in `docs/buck-workflow.md`. Leave the checked-phase sentence and the heavy-lift handoff for every other miss.
8. Prove both incident shapes and the tradeoff cases through `handleLoop` with the real scanner and machine. Do not mock `scan` or `next`.

## Acceptance criteria

- [x] AC-1: An ok iterating session that leaves exactly one `status: active` iterate file does not call `classifyRepair()`. The file becomes `status: completed` with `completed` and `updated` set to the supervisor date, the body and every other frontmatter line are unchanged, and the next effect is review.
- [x] AC-2: The same close happens for an unphased plan whose status is still `active` and whose acceptance boxes are open. Plan status and boxes are unchanged.
- [x] AC-3: A failed iterating session does not close the iterate file and does not ask Jev to repair a phase status.
- [x] AC-4: Two unfinished iterate files are left unchanged. The diagnosis names both paths and statuses. Neither is closed.
- [x] AC-5: A `below-waterline` iterate file is not a close target and does not force the iterating postcondition to ambiguous. A completed iterate file still confirms the iterating postcondition without a lift.
- [x] AC-6: `explainAmbiguity()` on `status: completed` does not contain `not completed`. The existing building fixture still reports `phase status is pending, not completed` and its unchecked box.
- [x] AC-7: An ok iterate session that succeeds after one used retry is still closed, and retry counters, `loopCount`, and the iterate ceiling are unchanged by the close.
- [x] AC-8: A target with no frontmatter, an unterminated frontmatter block, a non-`active` status, or a failed write is left unchanged and the helper returns false; the run then reaches the normal diagnosis and lift path.
- [x] AC-9: A review that writes a new `status: active` iterate artifact routes back to `iterating`, and only that new file is closed by the next ok iterate session.
- [x] AC-10: `b-iterate` no longer says an active artifact stays blocking until review passes, and its closeout no longer forbids yielding before review and save. The review template no longer tells the iterate child to wait for review and save before completing the file. Both plugin copies are byte-identical to the canonical skills.
- [x] AC-11: Focused ambiguity, scan, and loop tests pass. Required guardrails gates pass. No ranking or SQL-save source is part of the diff.

**Verified 2026-10-03.** Full suite 1495 passed / 6 skipped / 88 files. `npm run guardrails:check` → `status: pass` (unit, global ratchet, complexity pass; patch advisory; lint and functional disabled). Coverage 88.3 vs baseline 84. `tsc` diagnostics on the touched source files are clean and the new tests add zero diagnostics (196 before and after, measured by stashing the test file). The `extensions/buck-loop/sql-save.ts` line in `git status` is pre-existing work from another item — the `subject:` addition in `saveDirective()` — and is not part of this change.

**Three deviations from the plan, all forced by evidence.**

1. The close is applied in `executeSkill()` via `closeIterateAfterSession()`, not in `resolveAmbiguity()`: a used retry or an exhausted limit never reaches the ambiguity choice, so a close placed only there would miss exactly the incident runs. That extraction also keeps `executeSkill()` inside the complexity ceiling, which a required guardrails gate enforced.
2. The iterate artifacts are supplied to the lift judge itself through `AmbiguityEvidence.iterateReport` (built by `iterateEvidence()` in the production `classifyRepair`), not appended in `stopForOperator`. Appending after Jev answered left the original failure mode intact: Jev's lift question and the light/medium retry handoff never named the artifacts.
3. `productionClassifyRepair` is exported so a test can drive the real diagnosis. A test fake that re-implements the wiring proves nothing about the wiring.

**Only one close call site is load-bearing; the second was dead and has been removed.** The `executeSkill` close is proven: disabling it turns `closes after a retry that bypasses the ambiguity choice` red. The former `resolveAmbiguity` close was *not* proven, and the earlier claim in this file was wrong. Re-running the mutation from a clean green baseline (78 passed) with only that call site deleted changed nothing — 78 passed, 0 red. An earlier mutation run appeared to show it mattered, but that run was invalid: the test was already failing for an unrelated reason, so the removal could not have been observed.

It is unreachable by construction. A snapshot reaches `resolveAmbiguity` from `executeSkill`, which already applied the close; if that close succeeded the postcondition is no longer ambiguous and the machine emits no `choose`. The resume argument does not rescue it: `persist.ts` `Projection` has no `workFacts` field at all, so no stale `ok`+`ambiguous` snapshot can be persisted, and `reconcile()` rebuilds `workFacts` from a live `scan()` that returns `pending` for any non-`ok` outcome. The call site was deleted; the full suite still passes.

The close is byte-exact — a whole-file comparison confirms one opening and one closing delimiter, the body unchanged, and only `status`/`completed`/`updated` rewritten.

**Smoke requires `SQL_MEMORY_URL` unset.** It is set in this shell, so `sqlMode()` would take the SQL path. Run as `env -u SQL_MEMORY_URL bun <smoke>`; the run then reaches `done` via `b-build > b-review > b-iterate > b-review > b-save > b-commit`.

## Verification

```bash
npx vitest run extensions/buck-loop/__tests__/ambiguity.test.ts extensions/buck-loop/__tests__/scan.test.ts extensions/buck-loop/__tests__/loop.test.ts
npm run guardrails:check
```

The loop fixture must construct the two incident shapes: a completed phase plus one active iterate file, and an unphased active plan plus one active iterate file. Assert `classifyRepair` is not called and the following skill is review. Additional fixtures: two active iterate files assert zero frontmatter writes; a failed iterate session asserts no close; an ok-after-retry run asserts the close still happens with `loopCount` and the iterate counter unchanged; a fresh active artifact written by review routes back to `iterating`.

A disposable supervisor smoke (temp git repo, real `scan`/`next`/`handleLoop`, fakes only for `runStep`/`choose`/`classifyRepair`) exercises the same shapes end to end and is deleted afterward.

Expected guardrails contract: unit, global ratchet, and complexity required; patch advisory; lint and functional disabled. Do not lower the coverage baseline or complexity ceiling. Fresh diagnostics on the touched TypeScript files must be clean.

## Execution Instructions

This is one non-phased repair. Implement it directly in this plugin checkout, scoped to the files listed above. Do not adopt ranking, commit-phase-identity, or unrelated dirty files from this worktree.

1. Change only the files named in `files:`. Leave every other staged or unstaged path in this worktree as it is; if the change has to be backed out, revert the scoped paths instead of resetting the tree.
2. Run `/b-build-hard` against this plan.
3. Run `/b-review` against this plan.
4. If review creates an `iterate-*.md` for an in-plan defect, run `/b-iterate`, complete that artifact, and re-run `/b-review`. Out-of-plan findings go to a separate `/b-plan`. If review flags documentation impact beyond the sentence in this plan, run `/b-docs` before `/b-save`.
5. Run `/b-save`, then `/b-commit`.
6. Restart OMP before the fixed supervisor can affect a live loop. `/reload` does not reload imported extension modules.
7. The two already-blocked runs are not edited by this implementation. After restart, resume each only if the operator wants that work to continue. `persist.ts` synthesizes a confirmed postcondition only when it retains a completed projected phase while the scanner selects a different phase; an unphased projection with no phase path does not get that shortcut, so its resume is not guaranteed to enter review directly. The new close applies wherever an ok iterate session runs. Setting those two files to `completed` before resume is optional and outside this commit.

## Risks

- A child that reports ok without applying the fixes gets a review instead of another iterate cycle. That is the selected tradeoff. Review is the checker.
- The loaded OMP process will not pick up `loop.ts` until restart. Shipping the patch without restart does not unstick a running supervisor.
- The close is bounded to a single file with well-formed `active` frontmatter and a verified status change. Anything else fails closed into the existing diagnosis path rather than rewriting an artifact the supervisor cannot safely edit.
- Two unfinished iterate files are not a guarantee of an operator stop: Jev may still classify that diagnosis as a light or medium lift. The non-mutation is the guarantee; the eventual route is unchanged.
- The scanner now ignores `below-waterline` iterate files. A ranking branch that expects that value must finish it; until then such an artifact no longer forces `iterating` here. That is the plan's stated minimal scanner compatibility, not an endorsement of the ranking policy.
- The two already-blocked runs report unrelated required SQL gate failures. This repair does not clear them; closeout needs either a fix or an explicit operator override.
