---
status: completed
date: 2026-09-29
updated: 2026-09-29
subject: 2026-09-28.sql-memory-buck-loop
topics: [review, iteration, sql-memory, save-provenance]
informs: []
addresses: phase-3-sql-save-truthful-completion.md
completed: 2026-09-29
from_review: b-review
---

# Iteration: SQL save project identity and phase selection

## Source
- Reviewed after: `/b-iterate`
- Phase: `phase-3-sql-save-truthful-completion.md`
- Baseline: `7705adf` plus staged Phase 3 implementation; unrelated staged/unstaged work was not attributed to this review.

## Critical Issues

### 1. Resume accepts a receipt for a previous project identity
- **File**: `extensions/buck-loop/sql-save.ts:241-260,296-315`
- **Problem**: `verifySqlSave` compares the subject and projected attempt ID, then reads rows under `attempt.project`. It never compares `attempt.project` with the current Git project identity. After `origin` changes between save and resume, the old receipt and old-project rows still verify, allowing `saving → committing` in the new project. A throwaway `bun -e` fixture initialized a Git repo, completed a no-fact receipt for `git@example.test:org/old.git`, changed origin to `git@example.test:org/new.git`, then obtained `{status:"verified"}` with the projected attempt ID. The same identity gap applies to row receipts. This violates Phase 3's same-project commit postcondition.
- **Proposed fix**: Re-resolve current project identity at verification time and block when it differs from the attempt project (or when it cannot be resolved), before accepting either no-fact or rows receipts. Cover save → origin change → resume for both receipt kinds, retaining normal same-origin resume.

### 2. Standalone improved save selects phase 10 before phase 2
- **File**: `extensions/b-save-improved/index.ts:29-42`
- **Problem**: `incompletePhase` sorts `phase-N-*` filenames lexicographically. With active `phase-2-work.md` and `phase-10-work.md`, `savePhase(cwd, subject, null, false)` returned `phase-10-work.md` in a throwaway Bun fixture. Facts from the earlier active phase are recorded in the wrong `memories.context.phase`, violating the subject/phase/source context requirement.
- **Proposed fix**: Use numeric phase order when finding the first incomplete phase; retain projected-phase authority and explicit null for unphased subjects. Add a phase-2/phase-10 regression test.

## Warnings
- `extensions/b-save-improved/__tests__/save-phase.test.ts` exercises the phase helper but not the whole projected improved-save handler against a disposable database. The Phase 3 improved-save projected receipt path remains unverified end to end; Phase 4 owns deployed `/buck-loop` proof.

## Recommended Workflow
Start with `/b-iterate` against this artifact, then re-run `/b-review` against Phase 3. Do not treat the phase's completed status or the guardrails pass as proof of these postconditions. The supervisor owns the next loop state.
