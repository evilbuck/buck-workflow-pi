# Resume `/buck-loop` after a supervisor repair

Use this when `/buck-loop` stops with `Restart OMP before continuing` after a change under `extensions/buck-loop/`.

## Steps

1. Review the reported changed files and keep unrelated work out of the repair commit.
2. Exit OMP and launch a fresh OMP process in the same repository. Reusing the current process keeps the old extension loaded.
3. Run `/buck-loop --status` to check the saved blocked reason, then `/buck-loop --resume`. If the working tree is dirty, review the paths before accepting the continuation prompt.
4. **Eat:** The restarted run no longer refuses with `Restart OMP before continuing`; it resumes work or reports the specific operator prerequisite still missing.

If the phase names a missing disposable database or credential, provide it before expecting the phase to finish. A restart does not supply operator input.
