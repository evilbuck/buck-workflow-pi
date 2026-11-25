---
status: completed
date: 2026-11-25
updated: 2026-11-25
subject: 2026-11-23.full-orchestration-review
topics: [review, iteration, routing]
informs: []
addresses: plan-resume-safe-orchestration.md
completed: 2026-11-25
from_review: b-review
---

# Iteration: full-orchestration resume-safe rewrite

## Source
- Reviewed after: `/b-iterate` (re-review of the 2026-11-25 resolution)
- Plan: `plan-resume-safe-orchestration.md`
- Baseline: `7dd702f`; branch `feat/buck-loop-goal-skill` at `d60c8c5` plus the uncommitted iteration diff

Prior cycle (2026-11-25) stays closed: fixture residue removed from the worktree, §0 corrected, live trials A–C recorded, generic template fixed to `skills/b-<stage>/SKILL.md`, major-in-plan rows moved above `review → iterate`, Done no longer accepts a blocker list, spent-cap `enter → blocked` added, and the warning-4 wording fixes landed. Do not redo those.

## Critical Issues

### 1. `review → build` / `buildHard` guards are not decidable, and restart does not repeat them
- **File**: `skills/b-full-orchestration/references/stage-map.md:80-82` and `:67`
- **Problem**: The first-true-row rule now depends on "major", "non-major", and "newly complex". None of those predicates is defined in the stage map, and `b-review` does not emit them (verdict is Pass / Pass with warnings / Needs work; the iterate artifact has Critical Issues and Warnings). The plan's goal is that the same slice and the same evidence pick the same next stage. Trial B had to invent "non-major" in the review body to choose `review → iterate`. A second supervisor can call the same verdict major and dispatch `b-build` or `b-build-hard` instead. Restart makes a different choice again: `enter → iterate` (`stage-map.md:67`) sends every active `iterate-*.md` under the cap to `b-iterate`, so a review that took `review → buildHard` comes back as `b-iterate`.
- **Proposed fix**: In the guard notes, define both predicates from evidence the review artifact already has, and use that same pair on `enter`. Example that keeps the three rows: major means the iterate artifact's recommended workflow says `/b-build` or `/b-build-hard` (larger rework); newly complex means that recommendation is `/b-build-hard` or the review says the remaining work is complex, ambiguous, or risky. Anything else with in-plan issues is non-major and goes to `b-iterate`. On `enter`, an active iterate file whose recommendation is build or build-hard must take that edge, not unconditional `b-iterate`, still subject to the spent-cap block.

### 2. Phase `buck_hint` spelling never selects hard build
- **File**: `skills/b-full-orchestration/references/stage-map.md:68`
- **Problem**: The guard matches `` `buck_hint` is `b-build-hard` ``. `skills/b-phase/SKILL.md:176` writes `buck_hint: /b-build | /b-build-hard`. A hard phase whose prose does not also say "complex, ambiguous, or risky" fails this row and falls through to `enter → build`. Acceptance criterion 1 (hard build receives hard difficulty) is then missed for the canonical phase frontmatter. Trial A used the unslashed spelling, so it did not catch this.
- **Proposed fix**: Treat `b-build-hard` and `/b-build-hard` as the same hint (and `b-build` / `/b-build` as standard). Keep the prose disjunct.

## Warnings

### 1. Ideation cap is exact equality
- **File**: `skills/b-full-orchestration/references/stage-map.md:47`
- **Problem**: `ideation returns is 2` does not match a reconstructed count of 3 or more. The explore/research rows require "under 2", so an over-cap count matches neither and can fall through to `detect → run` (`stage-map.md:51`) while plan questions are still open. Iterate and guardrails were just widened to "or more"; ideation was not. A count that increments by one still hits 2 and blocks.
- **Suggested approach**: Change the blocked guard to `ideation returns is 2 or more`.

### 2. Numbered run step skips the outer `run → blocked` row
- **File**: `skills/b-full-orchestration/SKILL.md:26` versus `references/stage-map.md:55-56`
- **Problem**: Step 5 says "Return to `detect`" after every run return. The table re-detects only when the returned commit is the tip, and stops when the run returned blocked or a question. A literal reading of the numbered step re-enters `detect → run` on an unfinished slice and dispatches another run worker. The inner machine still refuses a spent cap, so this loops blockers rather than committing.
- **Suggested approach**: After a run returns, take the outer `run →` row. Re-detect only on `run → detect`. On `run → blocked`, stop.

### 3. Work sits on an unrelated branch name
- **File**: branch `feat/buck-loop-goal-skill` (tracks `origin/feat/buck-loop-goal-skill`)
- **Problem**: The orchestration commits still sit on a branch named for unrelated prior work. Left to the user on the prior cycle.
- **Suggested approach**: Move to a dedicated branch before the PR.
- **Resolution (2026-11-25, corrected)**: Branch move reverted per user correction — work stays on `feat/buck-loop-goal-skill` and will re-push there. The move was undone (`checkout` back, temporary branch deleted, fixes restored onto this branch as uncommitted changes and verified intact). Branch rename is declined; the warning is closed as "won't fix" on the branch-name point.

## Recommended Workflow

Start with `/b-iterate` — it will pick up this file automatically.
Then re-run `/b-review` against `plan-resume-safe-orchestration.md`.
Inside an OMP execution session, `/b-iterate` completes this artifact before it returns; the supervisor then re-reviews. Do not leave the file `active` waiting for review or save.
For larger rework, use `/b-build` or `/b-build-hard`.
