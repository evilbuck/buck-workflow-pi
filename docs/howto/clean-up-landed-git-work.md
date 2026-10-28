# Clean up landed local Git work

Delete proven-landed clean local branches and registered worktrees, then decide what to keep among the rest. `/git-clean-orphans` is an alias with the same automatic-delete behavior, not the old confirmation gate.

## Steps

1. Open your Pi/OMP session in the target repository with the `git-cleanup` skill and prompt installed. Have Bun and Git available; Git must support `merge-tree --write-tree -z`.
2. Run `/git-cleanup dry-run`. Review the base ref/SHA, fetch result, proposed deletions and exact worktree paths, ask rows, and skip reasons. This previews without deleting; fetch can still update local remote-tracking refs.
3. Run `/git-cleanup` when ready to delete the freshly proven set. There is no second confirmation for eligible clean locals. Registered worktrees outside the repository's parent are included; unregistered directories are not targets.
4. Answer keep or delete locally for the remaining ask rows, naming each item or an explicit subset. The script still refuses a name whose fresh disposition is `ask` or `skip`; consent does not bypass containment or cleanliness. If your requested deletion cannot be expressed by the bundled interface, stop rather than use force removal or hand-written deletion commands.
5. **Eat:** the agent reports the actual `applied` and `refused` entries, skip reasons, and retained ask rows. Count a branch deletion only when its `applied` entry has `ok: true`; an `auto-delete` preview alone is not a removal result. Check the reported removed branches and worktrees against `git branch --list` and `git worktree list --porcelain`.

The current checkout, integration branch, and main worktree are skipped. Dirty/untracked work, unique `.context` content, and uncheckable entries are retained. A failed worktree removal prevents deletion of its branch. No remote branches are deleted.

If the base cannot be resolved or the invocation fails, stop and resolve the reported prerequisite. If apply is unavailable in the installed version, do not substitute manual deletion commands.

For an inspection-only shell workflow, see [Inspect local Git cleanup candidates](inspect-git-cleanup-candidates.md).
