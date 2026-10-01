---
status: active
date: 2026-09-30
subject: 2026-09-30.buck-loop-unphased-closeout
topics: [buck-loop, closeout, subject-lifecycle, acceptance]
research: []
iterations: []
spec: null
memory: []
---

# Plan: Refuse unphased done without closeout evidence

## User Goal

Operators running `/buck-loop` on an unphased plan get either a verified subject closeout or a resume that names the open acceptance boxes. They do not get a terminal `done` that leaves the plan and subject open and then exits immediately on `--resume`.

## Goal

Stop `committing-unphased-done` and `committing-choice-advance-unphased` from treating a confirmed commit as plan completion. Reuse the existing closeout evidence (`plan` frontmatter `status: completed`) and make resume of a false `done` repairable without starting another build.

## Context used / assumptions

- User-provided context: the `2026-09-30.sql-memory-tui-notice` run ended `done` with reason `unphased plan completed its single cycle` while all seven plan acceptance boxes were open and `index.md` stayed `status: active`. Resume was left alone because it would exit immediately.
- Session context: that run did commit. `HEAD` is `00466ca`. This plan does not rewrite that commit or check those boxes.
- Probe: Buck capability `full`. Probe source: system available-skills catalog (`b-build`, `b-review`, `b-save` all resolve).
- Diagnosis red loop, live tree: `state=done`, `subjectStatus=active`, `openCount=7`.
- Diagnosis red loop, minimized (`bun` import of `resume`, `next`, `applySubjectLifecycleIntent`):
  - projection `done` + unphased plan with open `## Acceptance criteria` boxes resumes `state: done`, `planFacts.kind: unphased`.
  - `committing` + confirmed postcondition + `planFacts.kind: unphased` returns `done` / `unphased plan completed its single cycle`.
  - `close-verified` returns `not-verified` / `plan-demo.md: unphased plan remains open` for `status: active`, including after every body box is `[x]`.
  - the same plan with frontmatter `status: completed` and still-open body boxes closes the subject.
- Winning cause: `extensions/buck-loop/machine.ts` rules `committing-unphased-done` and `committing-choice-advance-unphased` do not read the plan. `extensions/buck-loop/persist.ts` only downgrades a false `done` when `planFacts.kind === "phased-incomplete"`. `haltIfTerminal` then returns. `skills/_shared/scripts/subject-lifecycle.ts` `collectPlanBlockers` treats unphased `status: completed` as sufficient and ignores body boxes. No loop writer sets that status. `b-build` checks phase-file boxes, not the plan's `## Acceptance criteria` section.
- Archived `.context/backlog/archive/2026-09/unphased-plan-closeout-evidence.md` only defined the status signal. It did not wire the loop to that signal. Do not weaken phased verification and do not trust a caller-supplied boolean.
- Assumption: a plan with no `## Acceptance criteria` list keeps today's status-only evidence. An open box in that section is a blocker even if status already says `completed`.

## Decision Closure

Selected course: fail closed at the supervisor. `done` for an unphased plan requires the plan file to be close-eligible: frontmatter `status: completed` and no open body acceptance box. The loop may write `status: completed` only when that body list exists, is non-empty, and every box is already `[x]`, matching `markPhaseCompleted`. It must not check boxes. Resume of `done` or a closeout block while the plan is ineligible stays blocked and must not `USER_CONFIRMED` into `resolving` / `building`. When a later resume finds every box `[x]`, sync status, run `close-verified`, and if history already contains `committing` and the worktree is clean, return `done` without `runStep`.

Evidence: the two red loops above; `machine.ts` lines for both unphased done rules; `persist.ts` phased-only false-done block; `closeSubject` canonical completed retry returns before `verifyClose`, so a stricter check does not reopen already-completed subjects; `confirmBlockedResume` currently sends every still-blocked snapshot through `userConfirmed`, and `user-confirmed` targets `resolving`, whose unphased rule starts `b-build`.

Excluded scope: checking or inventing acceptance boxes; rewriting `00466ca`; closing `2026-09-30.sql-memory-tui-notice`; a new loop state; parsing child prose for closeout success.

Next action: implement the gate and the resume regression together. Do not land the machine change without the resume test that asserts `runStep` is not called.

## Assumptions Ledger

| id | statement | status | blocking | evidence | validation_path |
|---|---|---|---|---|---|
| A-1 | Body `[x]` boxes are not closeout evidence today; only unphased frontmatter `status: completed` is. | validated | false | minimized repro: checked boxes still `not-verified`; status completed closes even with open boxes | subject-lifecycle test in this plan |
| A-2 | A generic closeout `blocked` that resumes through `USER_CONFIRMED` restarts `b-build`. | validated | false | `confirmBlockedResume` plus `user-confirmed` → `resolving` → `resolving-unphased` | loop resume test asserts no `runStep` while boxes stay open |
| A-3 | Canonical `completed` retry does not re-run `verifyClose`. | validated | false | `closeSubject` returns `applied` before verification when canonical state is already `completed` | existing subject-lifecycle retry test must stay green |

## Material Risks

| failure_mode | impact | mitigation | rollback_or_fallback | validation_path |
|---|---|---|---|---|
| Resume of an ineligible unphased `done` starts another build or commit | Duplicate work or an empty follow-up commit on a finished tree | Ineligible resume stays `blocked` and skips `USER_CONFIRMED`. Eligible repair after boxes are `[x]` closes and returns `done` without `runStep` when history already has `committing` and git is clean | Revert the resume branch; projection `done` exits again | `handleLoop({ command: "resume" })` with open boxes: `runStep` not called. Second fixture with all `[x]` and a clean tree: `done`, `runStep` not called |
| Choice advance bypasses the automatic gate | Ambiguous commit still reaches `done` with an open plan | Apply the same eligibility predicate to `committing-choice-advance-unphased` | Revert that rule only if the automatic gate is also reverted | machine test for the choice rule with an ineligible snapshot |
| Plans with no body list, previously false-done, now block | Operators must set `status: completed` through the sync path or an evidenced status write | Absent list is not an open box. `done` still requires `status: completed`. Do not invent a list | Status-only evidence remains for a missing section | resume fixture with no `## Acceptance criteria` and `status: active` blocks; `status: completed` and no list stays `done` |
| Stricter `verifyClose` surprises an active subject whose status was completed while boxes stayed open | `close-verified` newly returns `not-verified` | That is the intended strengthening. Already-canonical `completed` subjects retry without re-verification | Revert the body-box blocker in `collectPlanBlockers` | lifecycle test: active + `status: completed` + open box refuses; canonical completed retry still applies |

## Scope

### In scope

- One helper for an unphased plan's `## Acceptance criteria` list and close eligibility.
- Supervisor write of `status: completed` only when that list is non-empty and every box is already `[x]`.
- `close-verified` refuses an open body box on an unphased plan.
- Both unphased committing done rules require eligibility. Otherwise `blocked`, reason names the unchecked lines and `unphased plan remains open`.
- Resume reconciliation and `confirmBlockedResume` so a false `done` does not exit and does not restart build.
- Regression tests at those seams.
- `b-build` instruction to check the unphased plan's `## Acceptance criteria` boxes only with the same evidence standard as phase boxes.
- Bundled `plugins/buck-workflow/skills/_shared/scripts/subject-lifecycle.ts` stays byte-identical to the canonical file.

### Out of scope

- Checking boxes from the supervisor or from this plan.
- Repairing or committing `2026-09-30.sql-memory-tui-notice`.
- Changing phased `acceptance_criteria` rules.
- A new projection version or `closeoutHold` field.
- Parsing `/b-save` text. The plan file and lifecycle CLI result are the evidence.

## Affected files

| Path | Change |
|---|---|
| `extensions/buck-loop/phase-completion.ts` | Parse `## Acceptance criteria` until the next `##`. Eligibility and status write. |
| `extensions/buck-loop/machine.ts` | Both unphased done rules gain the eligibility predicate. Ineligible confirmed commit blocks. |
| `extensions/buck-loop/persist.ts` | `done` + unphased + ineligible becomes `blocked`, same shape as the phased false-done case. |
| `extensions/buck-loop/loop.ts` | `confirmBlockedResume` does not `USER_CONFIRMED` while the plan is ineligible. Eligible repair may `close-verified` and return `done` without `runStep` when commit already landed and the tree is clean. |
| `skills/_shared/scripts/subject-lifecycle.ts` | Open body box is a blocker even when status is `completed`. |
| `plugins/buck-workflow/skills/_shared/scripts/subject-lifecycle.ts` | Byte copy of the canonical file. |
| `skills/b-build/SKILL.md` | On unphased completion, check `## Acceptance criteria` only when verified. |
| `extensions/buck-loop/__tests__/machine.test.ts` | Replace the unconditional unphased done assertion. |
| `extensions/buck-loop/__tests__/loop.test.ts` | Resume regression. |
| `extensions/buck-loop/__tests__/persist.test.ts` | False `done` downgrade. |
| `skills/_shared/scripts/subject-lifecycle.test.ts` | Open box refuses; missing list still follows status. |

## Implementation steps

1. Add the body-list parser and `unphasedCloseEligible` next to `markPhaseCompleted`. Eligible means frontmatter `status: completed` and no open box in `## Acceptance criteria`. A missing section has no open box. Do not treat `[X]` as checked; phase code uses `[x]`.
2. Extend the existing checked-phase sync so an unphased plan gets `status: completed` only when its body list is non-empty and every item is `[x]`. Leave open or empty lists unchanged. Never edit box characters.
3. In `collectPlanBlockers`, after the status check, push `<plan>: open acceptance box` when any body box is open. Keep the existing `unphased plan remains open` blocker when status is not `completed`. Copy the canonical file onto the bundled path.
4. Change `committing-unphased-done` and `committing-choice-advance-unphased` so they fire only when the snapshot says the plan is close-eligible. Add the ineligible confirmed-commit rule ahead of them. Block reason includes each unchecked line. Thread eligibility through scan/snapshot the same way phase done is already a fact; do not make the pure machine read the filesystem.
5. On resume, if the projection is `done` and the rescanned unphased plan is ineligible, return `blocked` with that reason. If it is `blocked` for this reason and still ineligible, skip `USER_CONFIRMED`. If every body box is `[x]`, sync status, call `close-verified`, and if history already includes `committing` and `git status --porcelain` is empty, persist `done` and return it without `runStep`. If `close-verified` refuses, stay `blocked` and include its blockers.
6. Update `skills/b-build/SKILL.md` so an unphased plan's `## Acceptance criteria` boxes are checked only with evidence, using the phase-file rule as the pattern. Do not tell the skill to set subject lifecycle fields.
7. Replace `committing → done for an unphased plan's single cycle` with an eligible fixture and an ineligible fixture. Add the resume tests from the Material Risks table. Add the lifecycle tests. Run the focused suites, then `npm run guardrails:check`.

## Acceptance criteria

- [ ] A confirmed unphased commit whose plan is `status: active` or has an open `## Acceptance criteria` box transitions to `blocked`, not `done`, on both the automatic rule and the choice-advance rule.
- [ ] `--resume` on that blocked or falsely `done` projection does not call `runStep` and does not return `done` while a body box is open.
- [ ] `--resume` after every body box is `[x]`, with `committing` already in history and a clean worktree, writes `status: completed`, `close-verified` succeeds, and the result is `done` without `runStep`.
- [ ] `close-verified` still refuses `status: active` with all boxes `[x]`, and also refuses `status: completed` while a body box is open. A missing `## Acceptance criteria` section does not add a box blocker.
- [ ] A canonical subject that is already `completed` still no-ops on `close-verified`.
- [ ] The supervisor never changes `[ ]` to `[x]`.
- [ ] Focused machine, persist, loop, and subject-lifecycle tests pass, and `npm run guardrails:check` passes.

## Verification

- `bun test extensions/buck-loop/__tests__/machine.test.ts extensions/buck-loop/__tests__/persist.test.ts extensions/buck-loop/__tests__/loop.test.ts skills/_shared/scripts/subject-lifecycle.test.ts`
- `npm run guardrails:check`
- Re-run the minimized repro shape: open boxes + projection `done` must come back `blocked`, not `done`.

## Execution Instructions

This plan crosses the loop terminal rule and subject-lifecycle evidence, and the resume route can restart `b-build` if split wrong. Run `/skill:b-phase` before implementation. If it stays one unit, use `/b-build-hard`, then `/b-review`. In-plan issues go through `/b-iterate` and another `/b-review`. Out-of-plan findings start a separate `/b-plan`. If review flags documentation impact, run `/b-docs` before `/b-save`. Then `/b-save` and `/b-commit`.

## Risks

- The current TUI-notice projection remains `done` until this gate is deployed and someone resumes it. After the gate, that resume should block with the seven open lines. Do not check them in the fix.
- `b-build` can still finish without checking boxes. That is acceptable: the loop blocks instead of claiming `done`.
