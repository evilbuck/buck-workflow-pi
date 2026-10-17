# Rebind an orphan scope

Copy retained knowledge from one selected orphan scope onto the current branch as new private revisions. Receipts, run state, audits, and attribution stay behind. Existing current-branch bodies are not overwritten.

## Steps

1. List scopes and copy one `scopeToken`: [Export an orphan scope](export-orphan-scope.md).
2. Rebind that scope onto this checkout's branch:

   ```bash
   bun skills/_shared/scripts/workflow-state-cli.ts recover '{"scopeToken":"TOKEN","action":"rebind"}'
   ```

3. **Eat:** the command exits 0. `items` are new revisions whose `source` starts with `recovered:TOKEN:`. A following `list` on this branch shows those logical names. A receipt or other run-private record from the orphan scope is not in `items`. If a current-branch body already occupies a logical name, the command exits non-zero and does not overwrite it.

Deleting or recreating a branch does not do this. A new incarnation does not inherit the old private artifacts by name.
