# Export an orphan scope

Copy retained private bytes out of a deleted, detached, unborn, or recreated branch without publishing them and without writing them onto the current branch.

## Steps

1. From the project checkout, list scopes:

   ```bash
   bun skills/_shared/scripts/workflow-state-cli.ts recover
   ```

2. Copy one `scopeToken` from `scopes`. Use the token, not the branch name.
3. Export that scope:

   ```bash
   bun skills/_shared/scripts/workflow-state-cli.ts recover '{"scopeToken":"TOKEN","action":"export"}'
   ```

4. **Eat:** the command exits 0. `selected.scopeToken` matches the token you passed. `items` include `bytesBase64` for the retained revisions. A following ordinary `list` on the current branch does not gain those bodies. Omitting the token, or passing a token that was not listed, exits non-zero.

To adopt the knowledge onto this branch instead, use [Rebind an orphan scope](rebind-orphan-scope.md).
