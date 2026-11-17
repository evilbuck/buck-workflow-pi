# Recover a blocked `/b-loop` run

Use the blocker message and checkpoint binding to resolve an interruption and continue safely with the same `/b-loop <subject>` command (legacy status/resume/stop/profile control flags were removed).

## Steps

1. Inspect the last blocker line in OMP logs (`Phase <N> · b-<stage> <milestone> · blocked`) and note `reason`, `nextSafeAction`, and any `attemptId`. Run `git status` if a worktree or staging refusal occurred.
2. Fix only the reported cause without deleting tests or bypassing safety checks:
   - **`b-build finished · blocked`**: keep the partial edits already on disk, finish the failing acceptance criteria manually or via `/b-build`, and re-run `/b-loop <subject>`.
   - **`b-review finished · blocked`**: open the named `iterate-*.md` or `review-*.md` artifact, resolve the findings (`b-iterate` or targeted edits), and re-run `/b-loop <subject>`. (If files changed after a clean review, `b-save starting · blocked` halts before saving and rewinds cleanly to rebuild/re-review on the next `/b-loop <subject>` run.)
   - **`b-save ... · blocked`**: inspect the save receipt and private `run-state` journal for the reported `attemptId` (or remove/repair any conflicting `.context/workflow/sql-save-attempt.json`). Completed save applications are adopted without creating duplicate memory notes.
   - **Pre-commit staging or tree mismatch (`b-commit ... · blocked`)**: unstage pre-existing index entries (`git reset`), move or commit unrelated work outside `.context/<subject>/`, `.context/memory/`, `.context/backlog/`, and declared phase `files:`, or inspect `HEAD` against the reported `baselineHead` and `expectedTree`. Never run a second commit over an already-landed matching commit (`HEAD^ === baselineHead && HEAD^{tree} === expectedTree` is adopted automatically).
   - **Closeout blocker on the final phase**: resolve remaining open plans/phases or invalid `index.md` provenance reported by `subject-lifecycle.ts`, without hand-editing `lifecycle_*` fields.
3. Re-run `/b-loop <subject>` in the same checkout/worktree and named Git branch.
4. **Eat:** `/b-loop <subject>` clears the blocker, advances from the checkpoint's last verified proof without duplicating landed saves or commits, and finishes with `state: "done"` (subsequent re-runs report `done` with zero new commits).
