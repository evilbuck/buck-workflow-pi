# Restore auto-fix evidence

Recover an existing auto-fix run's retained files without rerunning its issues.

## Steps

1. Open a terminal in the checkout that originally owned the auto-fix run. Keep its configured storage destination and machine identity available; a sibling worktree cannot read the run's private evidence.
2. Set `RUN_ID` to the run ID printed in the original `Run state: .../<run-id>/run.json` output. From the Buck Workflow source root, read its retained run record, supplying the owning checkout as `CHECKOUT`:

   ```bash
   bun skills/b-auto-fix/scripts/auto-fix.ts artifact read "$RUN_ID" run.json --cwd "$CHECKOUT"
   ```

3. Restore the retained run and issue exports:

   ```bash
   bun skills/b-auto-fix/scripts/auto-fix.ts artifact restore "$RUN_ID" --cwd "$CHECKOUT"
   ```

4. **Eat:** the read returns the expected `run_id`, repository and issue list; restore prints the owning checkout's `.context/auto-fix/<run-id>` directory, where `run.json` matches the retained record and the previously retained issue files are available.

Restore overwrites matching exports with retained bytes. It does not resume execution or recreate stages that were never retained. To inspect one retained issue artifact without restoring, replace `run.json` in the read command with a name such as `issue-7/review.md`. A missing run, missing artifact or unavailable store is an error, not permission to trust local copies.
