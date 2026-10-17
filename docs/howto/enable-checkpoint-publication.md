# Enable checkpoint publication

Turn on automatic publication for this checkout's project. Without it, ordinary reads stay on the current branch and nothing is promoted because a branch merged.

## Steps

1. Open the machine config: `$BUCK_WORKFLOW_CONFIG`, or `${XDG_CONFIG_HOME:-~/.config}/buck-workflow/config.yaml` when that variable is unset.
2. Under the project key whose `origins` match this checkout, set `integration_ref` to a full ref that already exists locally, such as `refs/heads/master`. Do not fetch. Do not invent a default branch.
3. From the project checkout, inspect the view:

   ```bash
   bun skills/_shared/scripts/workflow-state-cli.ts publication-view
   ```

4. **Eat:** the command exits 0 and prints JSON with `view` and `checkpoints`. An unmerged branch's unsealed draft is absent from `view.members`.

If the ref is missing or not a commit, reconciliation records `integration-tip-unprovable` and publishes nothing. That is not success. Why publication is opt-in: [ADR 0005](../adr/0005-versioned-integration-view.md).
