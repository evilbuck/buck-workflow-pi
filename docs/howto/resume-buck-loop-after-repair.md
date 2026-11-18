# Resume `/b-loop` after a runner or host update

Use this when installed files under `skills/b-loop/` or OMP package plugins changed while an OMP session already imported the runner module into its Bun `eval` worker. Because `import()` caches loaded TypeScript/ESM modules per worker lifetime, a fresh OMP session guarantees the updated runner loads cleanly.

## Steps

1. Review modified or uncommitted worktree files with `git status` and keep unrelated work outside the subject's `files:` scope before committing.
2. Exit OMP and launch a fresh OMP process in the same repository/worktree and named branch so the cached `eval` worker restarts with the updated installed `skills/b-loop/scripts/eval-buck-loop.ts`.
3. Re-run `/b-loop <subject>` with no extra flags (legacy status/resume/stop flags were removed). Completed saves, clean fingerprinted reviews, and matching single-parent commits are adopted idempotently from the private `(subject, branch, worktree)` checkpoint; see [Recover a blocked `/b-loop` run](recover-buck-loop.md) if a blocker remains.
4. **Eat:** The new OMP session loads the updated runner, resumes from the last verified milestone (`starting`, `working`, `finished`, or `verified`), and advances or finishes with `state: "done"`.
