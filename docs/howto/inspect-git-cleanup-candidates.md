# Inspect local Git cleanup candidates

Produce a JSON inventory of local branches and registered worktrees without removing either.

## Steps

1. Open a shell in the repository you want to inspect. Have Bun and Git available; Git must support `merge-tree --write-tree -z`. Optional authenticated `gh` supplies PR metadata.
2. Set `classifier` to the absolute path of `skills/git-cleanup/scripts/classify.ts` in your buck-workflow checkout or installation. Keep the shell in the target repository.
3. Run the classifier without flags:

   ```sh
   bun "$classifier"
   ```

4. Inspect `base.ref`, `base.sha`, and `fetch.ok`, then review each item’s `name`, `path`, `disposition`, `state`, and `description_source`. Check `unique_context_paths`, `dirty_paths`, and `conflict_paths` for retained work. Treat `remote: "unknown"` and `pr: null` as unavailable evidence.
5. **Eat:** the command exits 0 and prints one JSON object with `base`, `fetch`, and `items`. Your current checkout has `disposition: "skip"` and `skip_reason: "current"`; no branch or worktree was removed. An `auto-delete` row is only a candidate classification, not a deletion result.

If no supported base exists (`origin/HEAD`, local `master`, or local `main`), the command exits nonzero: resolve the repository’s intended integration ref before trying again. Do not guess a base or turn the preview into hand-written deletion commands.

The classifier runs `git fetch --prune origin` and can write merge-tree objects; it is not an offline or zero-write inventory. Fetch failure is reported in JSON and does not establish that any remote branch is gone. Omit `--apply` to keep this run inspection-only. For deletion, follow [Clean up landed local Git work](clean-up-landed-git-work.md).

For the proof and disposition contract, see [Git cleanup classifier](../buck-workflow.md#git-cleanup-classifier--local-containment-inventory).
