# Recover a blocked `/buck-loop` run

Use the saved run's cause to repair the interruption without skipping safety checks.

## Steps

1. Run `/buck-loop --status` in the affected repository. Read the blocker and the recovery command in the result. A stopped run says `Run stopped` and labels its previous blocker as historical.
2. Fix the named cause. For unstaged work, inspect `git status --short` and stage only changes you intend to commit. If the message says `Commit checkpoint interrupted`, check `git log -1` and staged changes first; run `/b-commit` only if the previous phase still needs its commit.
3. For a recoverable `blocked` run that offers `/buck-loop --resume`, run that command. After a stop (`aborted`) or an interrupted commit checkpoint, start with the exact `/buck-loop <phase-or-plan-path>` shown by status instead. A new safety refusal must be resolved, not bypassed.
4. **Eat:** `/buck-loop --status` no longer reports the original blocker: the run has continued or reports a new, specific cause and recovery path.
