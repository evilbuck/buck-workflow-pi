---
status: active
date: 2026-11-23
updated: 2026-11-23
subject: 2026-11-23.full-orchestration-review
topics: [review, iteration, fixture-residue, verification-gaps]
informs: []          # Filled by b-plan when referencing this iteration
addresses: plan-resume-safe-orchestration.md
completed: null
from_review: b-review
---

# Iteration: full-orchestration resume-safe rewrite

## Source
- Reviewed after: `/b-build`
- Plan: `plan-resume-safe-orchestration.md`
- Baseline: `7dd702f`; implementation commits `b9686df` + `defc114` on branch `feat/buck-loop-goal-skill` (no upstream)

## Critical Issues

### 1. Fixture store records committed to the working branch
- **File**: 11 paths in commit `defc114`: `.context/2026-11-23.orchestration-readme-pointer/{index.md,memory/a5d4d1f1256b2521293476437c1bf7ce.md,memory/orchestration-readme-pointer.md,plan-readme-orchestration-pointer}`, `.context/2026-11-23.orchestration-restart-safety-note/{2026-11-23-orchestration-restart-safety-phase1,memory/369d8643914d944c237c9c5d16e9ff68.md,phase-1-cycle-1,phase-1-cycle-2,phase-1-restart-safety}`, `.context/fixture-smoke/review-fixture-smoke`, `.context/orchestration-restart-safety-note/phase-2-cycle-1`
- **Problem**: These are workflow_state file-store records belonging to fixture subjects (Case A `orchestration-readme-pointer`, Case B `orchestration-restart-safety-note`, the `fixture-smoke` infra probe), not to this subject. The plan's scope is "Edit only these files under `skills/b-full-orchestration/`" plus this subject's required repo-projected records; fixture-subject records are neither. `verify-fixture-exercise.md` §0 claims "the main checkout was never touched by fixture work" — the committed tree contradicts that claim. Likely mechanism [INFERENCE]: the save-slot incident's manual file-mode `save-apply` (verify doc §6.4) wrote fixture records into the main checkout; `defc114` then swept them in.
- **Proposed fix**: Branch is local-only (no upstream). Drop the residue from history: `git reset --soft 7dd702f`, unstage and delete the 11 residue paths, then recreate the two commits (`b9686df`, `defc114`) with their original messages and the legitimate paths only (skills + subject artifacts; AGENTS/README/docs/prompts/commands). If history rewrite is declined, a follow-up commit removing the 11 paths is acceptable but leaves the false evidence claim in the verify doc — also correct that §0 sentence either way.

### 2. Three acceptance criteria lack live-trial evidence (criteria 1, 3, 4)
- **File**: `plan-resume-safe-orchestration.md` (acceptance criteria), `verify-fixture-exercise.md`
- **Problem**: The plan's own jev wrap-up records all seven criteria unticked (max noul 0.65). Verified live: c2, c5, c6, c7 fully; c1 only statically (18 targets resolve; I independently re-confirmed every `skills/<stage>/SKILL.md` exists); c3 partially (byte-change invalidation T3 ✅, retained-review reuse Case A ✅, but the in-plan-issue → iterate block at save/commit was only exercised as an open *acceptance criterion*, not a review verdict with in-plan issues); c4 partially (quick-fix no-re-enter T6 ✅, committed-phase skip Case B phase 2 ✅, but no spent-cap restart trial). The disposable fixture worktree (`feat/orchestration-fixture`) has been removed, so the missing trials need a rebuilt fixture.
- **Proposed fix**: Recreate the disposable checkout at the current branch tip and run the three named trials: (a) dispatch a `b-build-hard` stage and observe `Difficulty: hard` reaching `skills/b-build`; (b) a review returning in-plan issues, then verify save/commit block and the `review → iterate` edge fires; (c) exhaust the iterate cap (three `review → iterate` transitions), restart with a fresh worker, and confirm the reconstructed count stays spent (blocked, not reset). Tick the criteria with recorded evidence afterward.

## Critical Issues

### 3. Generic dispatch template resolves to nonexistent paths
- **File**: `skills/b-full-orchestration/references/stage-map.md:15` (resolution table, "any other `b-<stage>`" row)
- **Problem**: The procedure cell reads `skills/<stage>/SKILL.md`; substituting the stage suffix (e.g. `plan`) yields `skills/plan/SKILL.md`, which does not exist — the real path is `skills/b-plan/SKILL.md`. A literal-minded supervisor or worker resolving the template dispatches a nonexistent procedure file. The fixture's static GREEN check substituted the full target name, masking the ambiguity.
- **Proposed fix**: Change the template to `skills/b-<stage>/SKILL.md`.

### 4. `review → buildHard` / `review → build` rows are unreachable
- **File**: `skills/b-full-orchestration/references/stage-map.md:62-64`
- **Problem**: Under the first-true-row rule (stage-map.md:4), the `review → iterate` row ("verdict has in-plan issues, iterate count under 3") precedes and matches every in-plan failure, so the two "major in-plan" rows on lines 63–64 can never fire.
- **Proposed fix**: Move the two major-in-plan rows above `review → iterate`, or narrow line 62's guard to non-major in-plan issues.

### 5. `Done` admits a blocker list for plan-backed final runs
- **File**: `skills/b-full-orchestration/SKILL.md:84`
- **Problem**: "A plan-backed final run has `close-verified` success … or an explicit blocker list" contradicts `closeout → blocked` stopping before commit (stage-map.md:81), the stop rules (SKILL.md:71-74), and `run.md` ("Return actual blockers, never a successful completion with a blocker list"; "A blocked run does not commit"). A blocked closeout must not read as Done.
- **Proposed fix**: Remove "or an explicit blocker list" from the Done criteria.

## Warnings

### 1. Work sits on an unrelated branch name
- **File**: branch `feat/buck-loop-goal-skill` (HEAD `defc114`, no upstream)
- **Problem**: Both implementation commits sit on a branch named for unrelated prior work.
- **Suggested approach**: Move to a dedicated branch (e.g. `feat/b-full-orchestration`) before integration/PR; trivial while unpushed.

### 2. Untracked turn-memory artifact in the worktree
- **File**: `.context/turn-memory/turn-memory/ea1ab8a47b6bfa3a7ba6b1f0de5efa66.md`
- **Problem**: Stale session artifact, untracked; risks being swept into a future commit (this is exactly how issue 1 happened).
- **Suggested approach**: Delete it or leave it ignored; do not commit it.

### 3. `enter → iterate` guard omits the iterate cap
- **File**: `skills/b-full-orchestration/references/stage-map.md:49`
- **Problem**: An active `iterate-*.md` routes to `b-iterate` without checking "iterate count under 3", so a restart of a cap-exhausted slice re-dispatches iteration, violating SKILL.md:58 and the caps section.
- **Suggested approach**: Add `, iterate count under 3` to the guard so a spent slice falls through to `blocked`.

### 4. Minor contract wording/consistency defects
- **Files**: `SKILL.md:24,39-47,74`; `references/run.md:11-20,36`; `references/stage-map.md:34`
- **Problem**: (a) SKILL.md:74 "closeout or guardrails fails and the cap is spent" implies a closeout cap that the machines do not define; (b) run.md:36 "take commit → blocked so the orchestrator can create the feature branch" promises a resume the machines do not encode (`run → blocked` stops); (c) the stage-worker brief is duplicated between SKILL.md:39-47 and run.md:11-20 with drift (Difficulty line only in run.md; "Do not start the next stage." only in SKILL.md; neither carries the stage-argument / prepared-selection fields the resolution table requires); (d) SKILL.md:24 omits `backlog` from the pre-run-edge exit set; (e) stage-map.md:34's `detect → run` guard omits the unphased plan that line 42 defines as a run.
- **Suggested approach**: Fix each in place; consolidate the brief template into one location referenced by the other.

## Recommended Workflow

Start with `/b-iterate` — it will pick up this file automatically.
Then re-run `/b-review` against the same plan.
Inside an OMP execution session, `/b-iterate` completes this artifact before it returns; the supervisor then re-reviews. Do not leave the file `active` waiting for review or save.
For larger rework, use `/b-build` or `/b-build-hard`.
