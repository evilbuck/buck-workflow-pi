---
status: completed
date: 2026-09-22
subject: 2026-09-22.fix-buck-loop-deferred-docs-and-in-cycle-resume
topics: [buck-loop, documentation-routing, resume-safety, dirty-tree]
research: []
iterations:
  - iterate-fix-buck-loop-deferred-docs-and-in-cycle-resume.md
memory:
  - buck-loop-deferred-docs-resume-build-2026-09-22.md
---

# Plan: Fix buck-loop deferred-docs routing and in-cycle resume

## User Goal

Buck-loop operators can defer living-document and how-to work to a later phase, and can resume a blocked active cycle without an out-of-band commit, while unrelated dirty work continues to fail closed.

## Goal

Correct two coupled failure modes from the Teleport Phase 2 incident:

1. classify explicit no-current-phase and deferred documentation/how-to statements as no current impact, so a clean review routes directly to save; and
2. preserve active-phase work across an in-cycle block, then allow only that loop-owned work through the resume safety gate.

## Context used / assumptions

- User-provided context: `.context/backlog/items/fix-buck-loop-deferred-docs-and-in-cycle-resume.md`, including the Teleport wording and six acceptance criteria.
- Current parser: `extensions/buck-loop/scan.ts::parseReviewImpact` checks only the first content line against narrow `no documentation impact` / `no how-to impact` expressions. It therefore treats `No Phase 2 living-document impact...` and later-phase deferral wording as current impact.
- Current postcondition: `scan.ts::POSTCONDITION.documenting` requires a changed `CONTEXT.md`, `AGENTS.md`, `CLAUDE.md`, or `docs/**` path even when a fresh scan says neither impact flag is active.
- Current safety gate: `extensions/buck-loop/loop.ts::resumeRun` calls `refuseUnsafeWorkspace` before reading the projection, so the gate cannot distinguish a blocked in-cycle run from a stale `building` bookmark or a fresh start.
- Current tests correctly preserve protected-branch refusal, dirty-start refusal, and dirty `building`-resume refusal. Those remain invariants.
- Related future work: `.context/2026-09-21.jev-decision-opportunities/phase-2-review-contract-and-routing.md` will replace prose-derived routing with `buck.review/v1`; Phase 3 will replace recoverable chooser actions with `fix | continue`. This plan is the bounded compatibility and resume-safety fix needed before that cutover. Its public incident regressions must survive the typed migration.
- Ownership assumption: a loop invocation starts with no non-`.context` dirt. When the running loop halts, changes produced during that invocation can be marked as loop-owned before control returns to the operator. Any later unstaged or untracked change is unrelated and must block resume.

## Scope

- Expand current-impact classification to recognize explicit no-impact wording for both `documentation` and `living-document` terminology.
- Treat an explicit deferral to a named later phase as no impact for the current phase; keep vague, absent, or affirmative impact text flagged or unparseable.
- Make the documenting postcondition succeed without a living-doc diff when the rescanned impact flags are both false.
- Mark non-`.context` work as loop-owned when a running cycle halts, using the Git index as the ownership boundary.
- On resume, allow staged-only loop-owned dirt only for a projection that is authoritatively `blocked` from an in-cycle work state. Continue rejecting unstaged, untracked, mixed staged/unstaged, protected-branch, unreadable-projection, fresh-start, and non-blocked-resume cases.
- Cover the exact Teleport wording and both sides of the resume boundary through public scanner/supervisor behavior.

## Out of scope

- Replacing prose parsing with the planned `buck.review/v1` typed contract.
- Changing recoverable choice sets to `fix | continue`; that remains typed-output Phase 3.
- Repairing or replaying the already-advanced Teleport projection.
- Relaxing protected-branch policy or allowing arbitrary dirty starts.
- Inferring ownership from phase-file prose or maintaining a second file-ownership manifest.
- New user-facing commands, living documentation, or how-to pages; this restores intended existing behavior.

## Affected files

- `extensions/buck-loop/scan.ts`
  - classify current versus explicitly deferred impact;
  - let the documenting postcondition consult rescanned impact facts.
- `extensions/buck-loop/loop.ts`
  - stage loop-produced work before an in-cycle blocked return;
  - make resume safety projection-aware and distinguish staged ownership from unrelated dirt.
- `extensions/buck-loop/__tests__/scan.test.ts`
  - add exact incident and positive-control parser/postcondition cases.
- `extensions/buck-loop/__tests__/loop.test.ts`
  - add public routing, in-cycle block/resume, and unrelated-dirt regressions.
- `.context/backlog/items/fix-buck-loop-deferred-docs-and-in-cycle-resume.md`
  - link this plan during execution and complete/archive the item only after verification.

`extensions/buck-loop/machine.ts` should remain unchanged: it already routes a parseable no-impact report to saving and a confirmed documenting postcondition to saving. Its focused tests remain part of verification.

## Implementation steps

1. **Freeze the two incident reproductions red-first.**
   - Add a scanner fixture whose Documentation Impact begins with the supplied `No Phase 2 living-document impact...` wording and whose How-to Impact explicitly defers coverage to Phase 5.
   - Add positive controls proving affirmative current-phase documentation/how-to work still sets the corresponding flag and vague deferral text does not silently become clean.
   - Add a public `handleLoop` regression proving that incident report routes review → save without invoking `b-docs`, `b-howto`, or the chooser.

2. **Replace the narrow negative regex check with a current-impact classifier.**
   - Keep section/summary extraction fail closed: both impact fields remain required until the typed contract lands.
   - Normalize the first meaningful line, then recognize only explicit no-current-impact forms: `documentation` or `living-document` no-impact language, exact `None`, and deferral to a named later phase.
   - Leave affirmative, contradictory, or unrecognized text flagged rather than broadening the clean path.

3. **Make documenting recovery respect current review facts.**
   - Pass the rescanned review-impact expectation into `scanWorkFacts` / the documenting postcondition.
   - Return `confirmed` when neither documentation nor how-to impact is currently expected; otherwise continue requiring a changed living-doc path.
   - Cover a stale documenting state whose corrected review facts are false and whose source work remains dirty; it must advance to saving rather than offer `retry | advance | block`.

4. **Establish a durable in-cycle ownership boundary before returning blocked.**
   - Reuse the existing `git add -A` behavior to stage work only after the loop has started clean and is about to return an in-cycle block.
   - Do not stage on preflight refusals, protected branches, missing/unreadable projections, or dirty starts.
   - Preserve `.context/**` exclusions from dirty-tree refusal while using `git status --porcelain --untracked-files=all` so individual untracked paths and XY staged/unstaged state remain visible.

5. **Make resume safety projection-aware.**
   - Read and validate the projection before evaluating the resume dirt exception; keep protected-branch refusal first and unconditional.
   - Permit non-`.context` dirt only when the projection state is `blocked`, its last transition proves it halted from an in-cycle work state, and every allowed path is staged with no unstaged/untracked component.
   - Reject any added or modified unstaged path, mixed staged/unstaged path, non-blocked projection (including `building`), or provenance mismatch before applying `USER_CONFIRMED`.
   - Keep phase/plan identity checks in `confirmBlockedResume`; ownership permission must not weaken artifact reconciliation.

6. **Lock the safety matrix at the public boundary.**
   - Drive a real in-cycle block from `handleLoop`, assert the loop-owned source changes are staged, and resume to completion without an out-of-band commit.
   - Repeat with an unrelated file added after the block and assert resume refuses before nested work.
   - Retain and strengthen the existing dirty-start and dirty-`building`-resume tests; include staged, unstaged, untracked, and mixed-status cases where they exercise distinct safety decisions.
   - Keep the exact Teleport incident as an end-to-end routing fixture so typed review routing can later replace internals without deleting the behavior contract.

7. **Verify and close the tracked unit.**
   - Run focused scanner, machine, and supervisor tests.
   - Exercise the public loop API in a throwaway temp Git repository: incident wording skips docs, an in-cycle blocked run resumes with its staged phase work, and a newly added unrelated path is refused.
   - Run the durable guardrail contract; then update/archive the existing backlog item through the normal completion flow.

## Acceptance criteria

- [x] A Documentation Impact line beginning `No Phase 2 living-document impact...` yields `docsImpact: false`.
- [x] A How-to Impact line that explicitly defers coverage to Phase 5 yields `howtoImpact: false` for the current phase.
- [x] Affirmative or ambiguous impact wording is never silently classified as clean.
- [x] The Teleport report routes directly from reviewing to saving; docs/how-to and chooser effects do not run.
- [x] A documenting snapshot with both rescanned impact flags false confirms without requiring a living-doc diff and advances to saving.
- [x] A blocked in-cycle run resumes with only its loop-owned staged source work and needs no out-of-band commit.
- [x] Adding any unrelated unstaged, untracked, or mixed-status non-`.context` path after the block makes resume fail closed.
- [x] Dirty starts, protected branches, unreadable projections, and dirty non-blocked resumes—including `building`—remain refused before nested work.
- [x] Focused tests include the exact Teleport wording and exercise behavior through exported `scan` / `handleLoop` surfaces rather than private parser internals.
- [x] `npm run guardrails:check` returns a passing durable-contract verdict.

## Verification

- Red/green focused suite:
  - `npx vitest run extensions/buck-loop/__tests__/scan.test.ts extensions/buck-loop/__tests__/machine.test.ts extensions/buck-loop/__tests__/loop.test.ts`
- Throwaway public-API smoke in a temporary Git repo:
  1. start from a clean non-protected branch;
  2. emit the Teleport impact wording and confirm no docs/how-to call;
  3. force an in-cycle block with source changes and resume successfully;
  4. repeat with one post-block unrelated path and confirm refusal;
  5. remove the throwaway script/repo.
- Deterministic project gate: `npm run guardrails:check`.
- TypeScript language-server diagnostics for changed source and test files.

## Risks

- **Over-broad prose matching could suppress real documentation work.** Restrict clean classification to explicit no-current-impact and named-later-phase forms; positive controls remain flagged.
- **Staging changes mutates the operator's index.** Apply it only after a clean start and immediately before an in-cycle blocked return. The loop already stages all work before `b-commit`; this moves that ownership marker earlier only on the blocked path.
- **A blocked projection alone is insufficient provenance.** Require the last persisted transition to originate from an in-cycle work state and keep plan/phase identity reconciliation intact.
- **Typed review routing will replace parser internals.** Preserve the incident as a public behavior test and remove obsolete prose parsing only in the Phase 2 cutover, not in this fix.
- **Existing tests label all dirty resume work “unrelated.”** Split fixtures so each test proves where the dirt originated; otherwise the regression can return under a misleading test name.

## Recommended next step

Run `/b-build-hard` against this plan. The code change is small, but the Git-index ownership boundary and fail-closed resume matrix are safety-critical. This plan is bounded to one build/review cycle and does not need `b-phase`.
