# Prune retained /code-review runtime

Tombstone the current checkout's retained `/code-review` runtime in the configured store, then remove its optional git-common exports so the next invocation starts a fresh run.

## Steps

1. Confirm the runs you want to remove are no longer resumable. Any non-clean run is normally retained for automatic resume.
2. Run `/code-review --prune`.
3. **Eat:** the next `/code-review` invocation reports no resumable run for the current branch and starts a fresh run id.

If prune warns about running runs, resume or cancel those first. To start a new loop after pruning, [run the /code-review command](run-code-review.md).
