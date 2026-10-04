# Resume `/buck-loop` after a supervisor repair

Use this when `/buck-loop` stops with `Restart OMP before continuing` after a change under `extensions/buck-loop/`.

## Steps

1. Review the reported changed files and keep unrelated work out of the repair commit.
2. Exit OMP and launch a fresh OMP process in the same repository. Reusing the current process keeps the old extension loaded.
3. Run `/buck-loop --status` to check the saved reason and retained checkpoint. Run `/buck-loop --resume` only when status offers same-checkpoint recovery; missing identity or inconsistent ownership requires the manual recovery procedure below. If the working tree is dirty, review the paths before accepting any continuation prompt.
   A retained commit checkpoint resumes the same phase only after `/buck-loop --resume` is explicitly confirmed. The supervisor verifies a clean one-commit successor of the stored baseline before advancing; it will not rerun a commit that already landed. If the marker is absent or inconsistent, follow [blocked-run recovery](recover-buck-loop.md) and complete the prior phase manually before starting another phase.
4. **Eat:** The restarted run no longer refuses with `Restart OMP before continuing`; it resumes work or reports the specific operator prerequisite still missing.

If the phase names a missing disposable database or credential, provide it before expecting the phase to finish. A restart does not supply operator input.
