# Restore pinned PR evidence

Recover the original retained PR context and raw diff without refetching GitHub metadata or resolving a new SHA pair.

## Steps

1. Open a terminal in the checkout that captured the PR evidence. Keep its configured workflow store and machine identity available. Set `PR` to the original `owner/repo#number`; use the installed script's absolute path if this checkout does not contain Buck Workflow's `skills/` directory.
2. List the retained pins:

   ```bash
   bun skills/code-review/scripts/pr-context.ts --list "$PR"
   ```

3. Set `HEAD_SHA` to the exact `head_sha` of the desired pin. Restore that pin:

   ```bash
   bun skills/code-review/scripts/pr-context.ts --restore "$PR" --head-sha "$HEAD_SHA"
   ```

4. **Eat:** the JSON result says `restored_from: "configured-adapter"`, names the selected `base_sha` and `head_sha`, and includes both revision IDs and SHA-256 hashes. Its `context_path` and `diff_path` point to the restored `pr-context.json` and byte-preserved `pr.diff`.

The default output directory is `.worktrees/pr-<number>`; `--out` selects another export directory. Restore overwrites those two files. Both list and restore work without `gh`, but still require the owning checkout and configured service. If more than one pin matches, restore refuses rather than guessing; no local export or current PR state is used as a fallback.
