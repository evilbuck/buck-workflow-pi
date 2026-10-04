---
status: completed
date: 2026-10-03
subject: 2026-10-01.skill-command-viability
topics: [buck-loop, commit-checkpoint, phase-drift, recovery]
informs: []
---

# Commit refusal and phase-target drift

## User Goal

Diagnose the reported `/buck-loop` commit failure, identify the real unfinished checkpoint, and take corrective action only when it preserves unrelated work and the authoritative state machine.

## Conclusion

The reported refusal is the intended out-of-scope commit guard. A separate supervisor defect changes the commit target from completed Phase 1 to pending Phase 2 after the failed checkpoint, before Phase 1 has been committed. Do not fix the refusal by staging unrelated work or blindly resuming.

## Observed state

- `.context/workflow/buck-loop.json` is `blocked`; the last transition is `committing → blocked` at `2026-10-03T15:10:54.427Z`. No later `USER_CONFIRMED` transition exists.
- History contains one build/review/iterate/docs/save cycle, followed by `saving → committing` at `.387Z`, a same-state commit retry at `.411Z`, and the block at `.427Z`.
- The activity log records the first commit target as `phase-1-omp-stubs.md` at `15:10:54.388Z`, then the retry target as `phase-2-fold-duplicates.md` at `15:10:54.411Z`.
- Phase 1 is `status: completed`; Phase 2 is `status: pending`. Phase 1's prompt/command deletions, documentation and workflow artifacts remain staged. `git log` has no commit for its phase file. HEAD remains `b184c34` from the earlier receipt-subject work.
- The save receipt matches canonical subject `2026-10-01.skill-command-viability`, attempt `b99f75c5-5047-4b9a-a74e-de33e36399f7`, and run `0df64269-6027-49d1-8163-608dc47ce0a9`; it records `completed: true`, `probed: true`, and one memory id. The machine reached `committing`; this incident is not a SQL-save failure. No SQL-store query was performed in this diagnosis.

## Immediate cause: unrelated work is unstaged

`prepareCommitCheckpoint()` in `extensions/buck-loop/loop.ts:982–1012` checks all unstaged non-`.context` paths against the target phase's `files:`. It auto-stages declared paths plus `.context`, but throws before any staging when an out-of-scope path exists. `runNestedSkill()` calls it before launching `b-commit` (`loop.ts:777`).

The refused paths belong to separate work and appear in neither Phase 1's nor Phase 2's declaration:

- `extensions/buck-loop/sql-save.ts`, `skills/b-save/SKILL.md`, and its physical plugin copy: tracked, unstaged canonical-subject repair changes.
- `commands/plan-synopsis.md`, `prompts/plan-synopsis.md`, and `skills/plan-synopsis/SKILL.md`: untracked synopsis skill/command work.
- The 17 reported files under `docs/plans/`: untracked Astro plan-browser work.

Thus `b-commit` never started. Adding these paths to the cleanup phase or staging them wholesale would mix independent work into the phase commit. Older managed diagnosis skills say the guard stages only `.context`; current source also supports phase-declared paths, so that older description is stale.

## Secondary defect: the failed commit loses its phase

`FROZEN_PHASE` (`loop.ts:94–100`) includes build/review/iterate/docs/save states but excludes `committing`. `executeSkill()` rescans after a failed checkpoint as well as after a successful child (`loop.ts:696–710`). `rescan()` then uses the scanner-selected phase during `committing` (`loop.ts:1137–1162`). Since Phase 1 is marked complete, this selects Phase 2 before any successful commit.

This is not only a display-label error: the changed `phasePath` is persisted and used as the next checkpoint target. A successful commit must advance to the next phase, but a failed checkpoint must retain the unfinished phase's identity and scope.

## Executed verification

Ran a read-only Bun probe using the real exported `statusOf()`, persistence `resume()`, and pure machine `userConfirmed()` / `next()` functions. Output:

```text
actual status: blocked
reconciled phase: .context/2026-10-01.skill-command-viability/phase-2-fold-duplicates.md
planFacts.kind: phased-incomplete
workFacts: pending / 0 retries / pending postcondition
hypothetical USER_CONFIRMED edge: resolving
next pure-machine edge: building, run-skill build
```

This predicts Phase 2 would build after the unrelated-dirt admission gate is cleared; it does not recover the missing Phase 1 commit. The probe did not invoke `handleLoop`, launch a child, write a projection, stage files, commit, or resume the actual run. The quoted refusal itself was accepted as ground truth, not rerun.

## Safe recovery

1. Preserve/isolate the unrelated SQL-save and plan-browser/synopsis work in its own checkpoint or worktree; do not delete it or fold it into Phase 1.
2. Review the exact staged Phase 1 diff and complete its intended `draft-commit.md` checkpoint through operator-controlled `/b-commit`. Check its staged `AGENTS.md` change as well; it is not in Phase 1's declared `files:`. Do not assume the staging set is correct merely because it is already staged.
3. Verify Phase 1's commit exists before starting `/buck-loop .context/2026-10-01.skill-command-viability/phase-2-fold-duplicates.md`.

The actual `statusOf()` recovery guidance for a block from `committing` recommends completing the prior phase's missing commit and then explicitly starting the projected target. A blind `/buck-loop --resume` is not safe for this unfinished boundary.

No staging, committing, stashing, source edits, phase-status edits, or loop-state changes were made by this diagnosis.

## Repair requirements

- Retain the completed phase and its staging declaration across failed commit attempts and retries; advance only after the commit postcondition is verified.
- Preserve the unfinished checkpoint identity through a blocked-run restart; do not infer commit completion from phase `status: completed` alone.
- Exercise the real supervisor with two phases: complete Phase 1, fail its commit before the child starts, then prove the retry and recovery cannot build/commit Phase 2 before Phase 1's checkpoint is complete.
- Keep the out-of-scope guard intact. Merely adding `committing` to `FROZEN_PHASE` unconditionally would also freeze successful commits and is not a complete repair.

Verification scope: investigation only; the only repository mutation is this `.context` Markdown record. No source checks or test-suite pass are claimed.
